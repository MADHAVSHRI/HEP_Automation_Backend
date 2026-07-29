/**
 * verifyService.js — qr-service
 *
 * Validates the x-service-key header on internal service-to-service calls.
 * Only callers that possess the shared SERVICE_AUTH_KEY may reach routes
 * protected by this middleware.
 *
 * Security fix: C-03, C-08, C-11
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
