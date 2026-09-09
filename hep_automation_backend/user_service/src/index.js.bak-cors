const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const loggerMiddleware = require("./middlewares/loggerMiddleware");
const { connectDB } = require("./dbconfig/db");
const routes = require("./routes/index");
const initUploadDirs = require("./utils/initUploadDir");

const app = express();

// Disable Express fingerprinting — removes "X-Powered-By: Express" header
app.disable("x-powered-by");

app.use(
  cors({
    origin: ["http://localhost:3000", "http://14.139.180.41:3000"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-service-name"],
    credentials: true,
  }),
);

const { startLicenseExpiryNotifierCron } = require("./utils/licenseExpiryNotifier");

initUploadDirs();

app.use(express.json());
app.use(loggerMiddleware);
connectDB();
startLicenseExpiryNotifierCron();

// Serve uploaded files (bulk pass photos, vehicle docs, work orders, etc.).
// These are loaded directly via <img>/<a> tags which can't send auth headers,
// so they are served statically. Aadhaar etc. is masked at the API layer; raw
// photos/docs are only referenced from authenticated review pages.
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Health check — used by auth-service startup diagnostic
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.use("/api", routes);

// ── Global error handler ────────────────────────────────────────────────────
// Catches any unhandled errors passed via next(err) — including unexpected
// multer errors, validation throws, or controller exceptions — and returns a
// controlled JSON response instead of leaking stack traces or returning 500.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Multer errors (file size, count, invalid type, unexpected field)
  if (err && (err.code === "LIMIT_FILE_SIZE" || err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE")) {
    return res.status(400).json({ success: false, message: err.message || "File upload limit exceeded" });
  }
  if (err && err.name === "MulterError") {
    return res.status(400).json({ success: false, message: err.message || "File upload error" });
  }
  // Generic unhandled errors — log internally, return generic message
  console.error("[GlobalErrorHandler]", err);
  return res.status(500).json({ success: false, message: "An unexpected error occurred. Please try again." });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`User Service running on port ${PORT}`);
});