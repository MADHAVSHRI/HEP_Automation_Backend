const axios = require("axios");

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

const SERVICE_HEADER = { "x-service-name": "APPROVAL-ADMIN-SERVICE" };

function serviceHeaders(req) {
  return {
    ...SERVICE_HEADER,
    "x-service-key": process.env.SERVICE_AUTH_KEY || "",
    Authorization: req.headers.authorization || "",
  };
}

async function callUserService(method, path, data, req) {
  const response = await axios({
    method,
    url: `${userServiceUrl()}${path}`,
    data,
    headers: serviceHeaders(req),
    timeout: 15000,
  });
  return response.data;
}

async function callQrService(requestId, req) {
  const response = await axios.post(
    `${qrServiceUrl()}/api/qr/vvip-pass/${requestId}`,
    {},
    { headers: serviceHeaders(req), timeout: 30000, responseType: "arraybuffer" },
  );

  return response.headers["x-pdf-path"] || null;
}

function sendPdfBuffer(res, buffer, fileName) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}.pdf"`);
  return res.send(Buffer.from(buffer));
}

exports.getQueue = async (req, res) => {
  try {
    const query = new URLSearchParams(req.query).toString();
    const path = `/api/vvip-pass${query ? `?${query}` : ""}`;
    const result = await callUserService("get", path, null, req);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.status(200).json(result);
  } catch (err) {
    console.error("[vvipPassApproval] getQueue error:", err.response?.data || err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getDetail = async (req, res) => {
  try {
    const result = await callUserService("get", `/api/vvip-pass/${req.params.id}`, null, req);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[vvipPassApproval] getDetail error:", err.response?.data || err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.downloadPdf = async (req, res) => {
  try {
    const detailResult = await callUserService("get", `/api/vvip-pass/${req.params.id}`, null, req);
    const request = detailResult?.data;

    if (!request) {
      return res.status(404).json({ success: false, message: "VVIP pass not found." });
    }

    if (request.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "QR PDF is available only after Traffic approval.",
      });
    }

    try {
      const userPdfResponse = await axios.get(
        `${userServiceUrl()}/api/vvip-pass/${req.params.id}/pdf`,
        {
          headers: serviceHeaders(req),
          timeout: 30000,
          responseType: "arraybuffer",
        },
      );

      res.setHeader("Content-Type", userPdfResponse.headers["content-type"] || "application/pdf");
      res.setHeader(
        "Content-Disposition",
        userPdfResponse.headers["content-disposition"] ||
          `attachment; filename="${request.referenceNo || `VVIP_${request.id}`}.pdf"`,
      );
      return res.send(Buffer.from(userPdfResponse.data));
    } catch (userPdfErr) {
      console.warn(
        "[vvipPassApproval] user_service PDF unavailable, regenerating via QR service:",
        userPdfErr.response?.data || userPdfErr.message,
      );
    }

    const qrResponse = await axios.post(
      `${qrServiceUrl()}/api/qr/vvip-pass/${req.params.id}`,
      {},
      { headers: serviceHeaders(req), timeout: 30000, responseType: "arraybuffer" },
    );

    return sendPdfBuffer(res, qrResponse.data, request.referenceNo || `VVIP_${request.id}`);
  } catch (err) {
    console.error("[vvipPassApproval] downloadPdf error:", err.response?.data || err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to download VVIP QR PDF.",
    });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const qrPdfPath = await callQrService(req.params.id, req);
    if (!qrPdfPath) {
      return res.status(502).json({
        success: false,
        message: "QR PDF generation failed. Please try approving again.",
      });
    }

    const result = await callUserService(
      "post",
      `/api/vvip-pass/${req.params.id}/approve`,
      { approvedBy: req.user?.userId || null, qrPdfPath },
      req,
    );
    return res.status(200).json(result);
  } catch (err) {
    console.error("[vvipPassApproval] approveRequest error:", err.response?.data || err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const reason = req.body?.reason || req.body?.rejectionReason || "";
    const result = await callUserService(
      "post",
      `/api/vvip-pass/${req.params.id}/reject`,
      { reason: String(reason).trim(), rejectedBy: req.user?.userId || null },
      req,
    );
    return res.status(200).json(result);
  } catch (err) {
    console.error("[vvipPassApproval] rejectRequest error:", err.response?.data || err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.returnRequest = async (req, res) => {
  try {
    const reason = req.body?.reason || req.body?.returnReason || "";
    const result = await callUserService(
      "post",
      `/api/vvip-pass/${req.params.id}/return`,
      { reason: String(reason).trim(), returnedBy: req.user?.userId || null },
      req,
    );
    return res.status(200).json(result);
  } catch (err) {
    console.error("[vvipPassApproval] returnRequest error:", err.response?.data || err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
