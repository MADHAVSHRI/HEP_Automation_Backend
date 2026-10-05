// middlewares/parseJsonPayload.js
const parseJsonPayload = (req, res, next) => {
  try {
    if (req.body && typeof req.body.payload === "string") {
      req.body = JSON.parse(req.body.payload);
    }
    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload.",
    });
  }
};

module.exports = parseJsonPayload;