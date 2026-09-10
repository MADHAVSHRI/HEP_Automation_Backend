const express = require("express");
require("dotenv").config();
const loggerMiddleware = require("./middlewares/loggerMiddleware");
const { connectDB } = require("./dbconfig/db");
const routes = require("./routes/index");
const allowCredentials = require("../config/allowCredentials");
const corsConfig = require("../config/corsConfig");
const { globalLimiter } = require("./middlewares/rateLimiter");

const app = express();
app.use(allowCredentials);
corsConfig(app);

// Disable Express fingerprinting — removes "X-Powered-By: Express" header
app.disable("x-powered-by");

app.use(express.json({ limit: "1mb" }));

app.use(loggerMiddleware);
app.use(globalLimiter);
connectDB();
app.use("/api", routes);

/*
 * Multer's own failures arrive here, not as ordinary errors. Without this the
 * applicant gets an HTML stack trace on their phone for something as ordinary
 * as a photo above the size limit.
 */
app.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ code: "PAYLOAD_TOO_LARGE", message: "That photo is too large." });
  }
  if (err?.code === "UNSUPPORTED_MEDIA_TYPE") {
    return res
      .status(415)
      .json({ code: "UNSUPPORTED_MEDIA_TYPE", message: "Only JPEG or PNG photos are accepted." });
  }
  if (err) {
    console.error("Face-Verify unhandled error:", err.message);
    return res.status(500).json({ code: "SERVER_ERROR", message: "Something went wrong." });
  }
  return next();
});

const PORT = process.env.PORT || 5013;

app.listen(PORT, () => {
  console.log(`Face Verify Service running on port ${PORT}`);
});
