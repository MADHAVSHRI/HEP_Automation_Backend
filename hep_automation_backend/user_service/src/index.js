const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const loggerMiddleware = require("./middlewares/loggerMiddleware");
const { connectDB } = require("./dbconfig/db");
const routes = require("./routes/index");
const initUploadDirs = require("./utils/initUploadDir");

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "http://14.139.180.41:3000"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-service-name"],
    credentials: true,
  }),
);

initUploadDirs();

app.use(express.json());
app.use(loggerMiddleware);
connectDB();

// Serve uploaded files (bulk pass photos, vehicle docs, work orders, etc.).
// These are loaded directly via <img>/<a> tags which can't send auth headers,
// so they are served statically. Aadhaar etc. is masked at the API layer; raw
// photos/docs are only referenced from authenticated review pages.
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Health check — used by auth-service startup diagnostic
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.use("/api", routes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`User Service running on port ${PORT}`);
});