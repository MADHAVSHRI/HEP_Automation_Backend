module.exports = (req, res, next) => {

  const serviceKey = (req.headers["x-service-key"] || "").trim();

  const envServiceKey = (process.env.SERVICE_AUTH_KEY || "").trim();

if (serviceKey !== envServiceKey) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized service request"
    });
  }

  next();
};