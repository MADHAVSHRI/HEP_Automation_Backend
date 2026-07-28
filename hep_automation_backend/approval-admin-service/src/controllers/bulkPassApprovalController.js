/**
 * bulkPassApprovalController.js
 *
 * Traffic Officer actions for the Bulk Pass Module.
 * Orchestrates calls to user_service, qr-service, and email_service.
 *
 * Individual approval flow (new):
 *   POST /api/bulk-pass/:batchId/persons/:personId/approve  — approve one person
 *   POST /api/bulk-pass/:batchId/persons/:personId/reject   — reject one person
 *   POST /api/bulk-pass/:id/finalize                        — finalize when all actioned
 *
 * Kept for backward compatibility:
 *   POST /api/bulk-pass/:id/return   — return entire batch to applicant
 *   POST /api/bulk-pass/:id/reject   — reject entire batch (all PENDING → REJECTED)
 *
 * Requirements: 8.1–8.4, 11.2
 */

const axios = require("axios");
const crypto = require("crypto");

// ── Token encryption (mirrors user_service cryptoUtils) ───────────────────
// Used to build encrypted QR links that match what finalizeBatch produces.
function encryptToken(text) {
  if (!text) return "";
  try {
    const secret = process.env.JWT_SECRET || "default_jwt_secret_key_for_vendor_passes";
    const key = crypto.createHash("sha256").update(secret).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(String(text), "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, encrypted, authTag]).toString("base64url");
  } catch (err) {
    console.error("[bulkPassApproval] encryptToken failed:", err.message);
    return String(text);
  }
}

// ── Internal service helpers ───────────────────────────────────────────────

function userServiceUrl() {
  const url = process.env.USER_SERVICE_URL;
  if (!url) throw new Error("USER_SERVICE_URL not configured");
  return url;
}

function qrServiceUrl() {
  const url = process.env.QR_SERVICE_URL;
  if (!url) throw new Error("QR_SERVICE_URL not configured");
  return url;
}

function emailServiceUrl() {
  return process.env.EMAIL_SERVICE_URL || "";
}

const SERVICE_HEADER = { "x-service-name": "APPROVAL-ADMIN-SERVICE" };

/**
 * Forward the caller's Authorization header to internal services so that
 * verifyToken middleware on those routes passes (where required).
 */
function authHeaders(req) {
  return {
    ...SERVICE_HEADER,
    Authorization: req.headers.authorization || "",
  };
}

async function callUserService(method, path, data, req) {
  const response = await axios({
    method,
    url: `${userServiceUrl()}${path}`,
    data,
    headers: authHeaders(req),
    timeout: 15000,
  });
  return response.data;
}

async function callQrService(batchId, req) {
  const response = await axios.post(
    `${qrServiceUrl()}/api/qr/bulk-pass/${batchId}`,
    {},
    { headers: authHeaders(req), timeout: 30000, responseType: "arraybuffer" }
  );
  // filePath is returned in the X-Pdf-Path header (set by the QR controller)
  const filePath = response.headers["x-pdf-path"] || null;
  return { data: { pdfPath: filePath } };
}

async function sendEmail(endpoint, payload, { throwOnError = false } = {}) {
  const base = emailServiceUrl();
  if (!base) {
    console.warn("[bulkPassApproval] EMAIL_SERVICE_URL not set; skipping email");
    if (throwOnError) throw new Error("EMAIL_SERVICE_URL not configured");
    return;
  }
  try {
    await axios.post(`${base}/api/email/${endpoint}`, payload, {
      headers: SERVICE_HEADER,
      timeout: 8000,
    });
  } catch (err) {
    console.error(
      `[bulkPassApproval] Email dispatch failed (${endpoint}):`,
      err.response?.data || err.message
    );
    if (throwOnError) throw err;
  }
}

// ── Controllers ───────────────────────────────────────────────────────────

/**
 * GET /api/bulk-pass/queue
 * Returns all UNDER_REVIEW batches ordered oldest-first (Req 8.1).
 */
exports.getQueue = async (req, res) => {
  try {
    const result = await callUserService("get", "/api/bulk-pass/approval-queue", null, req);
    // Disable caching so the queue is never served stale/empty via a 304 response.
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.status(200).json(result);
  } catch (err) {
    console.error("[bulkPassApproval] getQueue error:", err.response?.data || err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/:id
 * Proxy batch detail from user_service — accessible to all traffic dept users
 * so they can view any batch (including COMPLETED ones) after approval.
 */
exports.getBatchDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await callUserService("get", `/api/bulk-pass/${id}`, null, req);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[bulkPassApproval] getBatchDetail error:", err.response?.data || err.message);
    if (err.response) return res.status(err.response.status).json(err.response.data);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/:id/pdf
 * Proxy PDF download from user_service — available to all traffic dept users
 * for COMPLETED batches so they can download or share the QR pass.
 *
 * Self-healing: if the PDF was not generated at finalize time (qrPdfPath is
 * null or the file is missing), regenerate it via the QR service, persist the
 * path, then stream the result.
 */
exports.downloadPdf = async (req, res) => {
  try {
    const { id } = req.params;

    // Helper: stream the PDF from user_service to the client
    const streamFromUserService = async () => {
      const response = await axios({
        method: "get",
        url: `${userServiceUrl()}/api/bulk-pass/${id}/pdf`,
        headers: authHeaders(req),
        responseType: "stream",
        timeout: 30000,
      });
      res.setHeader("Content-Type", response.headers["content-type"] || "application/pdf");
      const disposition = response.headers["content-disposition"];
      if (disposition) res.setHeader("Content-Disposition", disposition);
      response.data.pipe(res);
    };

    // First attempt: ask user_service directly
    try {
      await streamFromUserService();
      return;
    } catch (firstErr) {
      // Only attempt regeneration if user_service said the PDF is missing (404)
      const status = firstErr.response?.status;
      if (status !== 404) {
        // Some other error — surface it
        let body = { success: false, message: "PDF not available" };
        if (firstErr.response?.data) {
          try {
            const chunks = [];
            for await (const chunk of firstErr.response.data) chunks.push(chunk);
            body = JSON.parse(Buffer.concat(chunks).toString());
          } catch {}
        }
        return res.status(status || 500).json(body);
      }
    }

    // PDF missing — attempt on-demand regeneration via QR service
    console.log(`[downloadPdf] PDF missing for batch ${id} — regenerating via QR service`);
    let qrPdfPath = null;
    try {
      const qrResponse = await axios.post(
        `${qrServiceUrl()}/api/qr/bulk-pass/${id}`,
        {},
        { headers: authHeaders(req), timeout: 30000, responseType: "arraybuffer" }
      );
      qrPdfPath = qrResponse.headers["x-pdf-path"] || null;

      // Persist the newly-generated path back to user_service
      if (qrPdfPath) {
        callUserService("post", `/api/bulk-pass/${id}/update-pdf-path`, { qrPdfPath }, req)
          .catch((e) => console.warn("[downloadPdf] Failed to persist regenerated PDF path:", e.message));
      }

      // Stream the regenerated PDF directly from the arraybuffer we already have
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="BulkPass_${id}.pdf"`);
      return res.send(Buffer.from(qrResponse.data));
    } catch (qrErr) {
      console.error("[downloadPdf] QR regeneration failed:", qrErr.response?.data || qrErr.message);
      return res.status(503).json({
        success: false,
        message: "PDF not yet generated and regeneration failed. Please try again shortly.",
      });
    }
  } catch (err) {
    console.error("[bulkPassApproval] downloadPdf error:", err.response?.data || err.message);
    if (err.response) return res.status(err.response.status).json(err.response.data);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:id/resend-pass
 * Re-sends the approved-pass email (with QR link) to the applicant.
 * Available to all traffic dept users on COMPLETED batches.
 */
exports.resendPass = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch batch details from user_service
    const detailResult = await callUserService("get", `/api/bulk-pass/${id}`, null, req);
    const raw = detailResult?.data;
    const batch = raw?.batch || raw;

    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    if (batch.status !== "COMPLETED") {
      return res.status(400).json({ success: false, message: "Pass email can only be resent for COMPLETED batches" });
    }

    const FRONTEND_BASE = process.env.FRONTEND_BASE_URL || "";

    await sendEmail("sendBulkPassApproved", {
      email: batch.applicantEmail,
      refNo: batch.refNo,
      companyName: batch.companyName,
      validityFrom: batch.validityFrom,
      validityUpto: batch.validityUpto,
      departmentName: batch.departmentName,
      approvedCount: batch.approvedCount ?? null,
      rejectedCount: batch.rejectedCount ?? null,
      qrLink: FRONTEND_BASE ? `${FRONTEND_BASE}/bulk_pass_approved/${encryptToken(batch.id)}` : null,
    }, { throwOnError: true });

    return res.status(200).json({ success: true, message: "Pass email resent successfully" });
  } catch (err) {
    console.error("[bulkPassApproval] resendPass error:", err.response?.data || err.message);
    if (err.response) return res.status(err.response.status).json(err.response.data);
    return res.status(500).json({ success: false, message: "Failed to send pass email. Please try again." });
  }
};

/**
 * POST /api/bulk-pass/:batchId/persons/:personId/approve
 * Approve a single person within a batch (Req 8.2 — individual).
 */
exports.approvePersonInBatch = async (req, res) => {
  try {
    const { batchId, personId } = req.params;

    const result = await callUserService(
      "post",
      `/api/bulk-pass/${batchId}/persons/${personId}/approve`,
      { approvedBy: req.user?.userId || null },
      req
    );
    return res.status(200).json(result);
  } catch (err) {
    console.error("[bulkPassApproval] approvePersonInBatch error:", err.response?.data || err.message);
    if (err.response) return res.status(err.response.status).json(err.response.data);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:batchId/persons/:personId/reject
 * Reject a single person within a batch (Req 8.3 — individual).
 */
exports.rejectPersonInBatch = async (req, res) => {
  try {
    const { batchId, personId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || !String(rejectionReason).trim()) {
      return res.status(400).json({ success: false, message: "rejectionReason is required" });
    }

    const result = await callUserService(
      "post",
      `/api/bulk-pass/${batchId}/persons/${personId}/reject`,
      {
        rejectionReason: String(rejectionReason).trim(),
        rejectedBy: req.user?.userId || null,
      },
      req
    );
    return res.status(200).json(result);
  } catch (err) {
    console.error("[bulkPassApproval] rejectPersonInBatch error:", err.response?.data || err.message);
    if (err.response) return res.status(err.response.status).json(err.response.data);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:id/finalize
 * Called after all persons have been individually approved/rejected.
 * Generates QR PDF (approved persons only) and marks batch COMPLETED.
 */
exports.finalizeBatch = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Generate QR PDF via qr-service (only approved persons will be included)
    let qrPdfPath = null;
    try {
      const qrResult = await callQrService(id, req);
      qrPdfPath = qrResult?.data?.pdfPath || null;
    } catch (qrErr) {
      console.error(
        "[bulkPassApproval] QR generation failed (finalize):",
        qrErr.response?.data || qrErr.message
      );
      // Non-fatal: proceed with finalization; qrPdfPath will be null
    }

    // 2. Finalize via user_service — validates pending count, marks COMPLETED
    const finalizeResult = await callUserService(
      "post",
      `/api/bulk-pass/${id}/finalize`,
      {
        qrPdfPath,
        finalizedBy: req.user?.userId || null,
      },
      req
    );

    return res.status(200).json(finalizeResult);
  } catch (err) {
    console.error("[bulkPassApproval] finalizeBatch error:", err.response?.data || err.message);
    if (err.response) return res.status(err.response.status).json(err.response.data);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:id/return
 * Return batch to applicant for revision — reopens the upload link with remarks.
 * Requirements: 8.4
 */
exports.returnBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { returnReason } = req.body;

    if (!returnReason || !String(returnReason).trim()) {
      return res.status(400).json({ success: false, message: "returnReason is required" });
    }

    const result = await callUserService(
      "post",
      `/api/bulk-pass/${id}/return`,
      { returnReason: String(returnReason).trim() },
      req
    );

    return res.status(200).json(result);
  } catch (err) {
    console.error("[bulkPassApproval] returnBatch error:", err.response?.data || err.message);
    if (err.response) return res.status(err.response.status).json(err.response.data);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:id/reject
 * Reject entire batch — marks all pending persons as rejected.
 * Use when the whole submission is invalid (not just individual persons).
 * Requirements: 8.3
 */
exports.rejectBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || !String(rejectionReason).trim()) {
      return res.status(400).json({
        success: false,
        message: "rejectionReason is required",
      });
    }

    const rejectResult = await callUserService(
      "post",
      `/api/bulk-pass/${id}/reject`,
      {
        rejectionReason: String(rejectionReason).trim(),
        rejectedBy: req.user?.userId || null,
      },
      req
    );

    return res.status(200).json(rejectResult);
  } catch (err) {
    console.error("[bulkPassApproval] rejectBatch error:", err.response?.data || err.message);
    if (err.response) return res.status(err.response.status).json(err.response.data);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
