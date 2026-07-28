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

async function callQrService(requestId, req) {
  const response = await axios.post(
    `${qrServiceUrl()}/api/qr/vvip-pass/${requestId}`,
    {},
    { headers: authHeaders(req), timeout: 30000, responseType: "arraybuffer" },
  );

  return response.headers["x-pdf-path"] || null;
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
