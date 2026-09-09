/**
 * verifyService.js — gate-service
 *
 * Validates the x-service-key header on the hardware event route. Gate devices
 * are machines, not users: they carry the shared SERVICE_AUTH_KEY rather than
 * a user token, matching the convention in qr-service and
 * approval-admin-service.
 */
module.exports = (req, res, next) => {
  const serviceKey = (req.headers["x-service-key"] || "").trim();
  const envKey = (process.env.SERVICE_AUTH_KEY || "").trim();

  if (!envKey) {
    console.error("[verifyService] SERVICE_AUTH_KEY environment variable is not set");
    return res.status(500).json({ success: false, message: "Server misconfiguration" });
  }

  if (serviceKey !== envKey) {
    return res.status(403).json({ success: false, message: "Unauthorized service request" });
  }

  next();
};
