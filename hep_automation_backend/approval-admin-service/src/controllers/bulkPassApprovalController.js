/**
 * bulkPassApprovalController.js
 *
 * Traffic Officer actions for the Bulk Pass Module.
 * Orchestrates calls to user_service, qr-service, and email_service.
 *
 * Requirements: 8.1–8.4, 11.2
 */

const axios = require("axios");

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

async function sendEmail(endpoint, payload) {
  const base = emailServiceUrl();
  if (!base) {
    console.warn("[bulkPassApproval] EMAIL_SERVICE_URL not set; skipping email");
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
 * POST /api/bulk-pass/:id/approve
 * Approve a batch: set COMPLETED, generate QR PDF, send approval email.
 * Requirements: 8.2
 */
exports.approveBatch = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Generate QR PDF via qr-service
    let qrPdfPath = null;
    try {
      const qrResult = await callQrService(id, req);
      qrPdfPath = qrResult?.data?.pdfPath || null;
    } catch (qrErr) {
      console.error(
        "[bulkPassApproval] QR generation failed:",
        qrErr.response?.data || qrErr.message
      );
      // Non-fatal: proceed with approval, qrPdfPath will be null
    }

    // 2. Set batch to COMPLETED via user_service (internal endpoint).
    // Note: user_service's approveBatch sends the approval email (with the QR
    // view link), so we must NOT send another email here to avoid duplicates.
    const approveResult = await callUserService(
      "post",
      `/api/bulk-pass/${id}/approve`,
      {
        qrPdfPath,
        approvedBy: req.user?.userId || null,
      },
      req
    );

    return res.status(200).json(approveResult);
  } catch (err) {
    console.error("[bulkPassApproval] approveBatch error:", err.response?.data || err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
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
      {
        returnReason: String(returnReason).trim(),
      },
      req
    );

    // Note: user_service's returnToApplicant sends the return email, so we must
    // NOT send another one here to avoid duplicate emails to the applicant.

    return res.status(200).json(result);
  } catch (err) {
    console.error("[bulkPassApproval] returnBatch error:", err.response?.data || err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
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

    // Note: user_service's rejectBatch sends the rejection email, so we must
    // NOT send another one here to avoid duplicate emails.
    return res.status(200).json(rejectResult);
  } catch (err) {
    console.error("[bulkPassApproval] rejectBatch error:", err.response?.data || err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
