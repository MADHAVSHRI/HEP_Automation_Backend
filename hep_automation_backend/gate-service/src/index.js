const express = require("express");
require("dotenv").config();
const cors = require("cors");
const http = require("http");

const loggerMiddleware = require("./middlewares/loggerMiddleware");
const routes = require("./routes/index");
const { sequelize } = require("../models");
const { attachSocketServer } = require("./realtime/socketServer");

const app = express();

const corsOrigins = [
  "http://localhost:3000",
  "http://10.167.40.13:3000",
  "http://14.139.180.41:3000",
];

app.use(
  cors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-service-name", "x-service-key"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(loggerMiddleware);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL Connected Successfully");
  } catch (error) {
    console.error("PostgreSQL Connection Failed:", error.message);
    process.exit(1);
  }
};

connectDB();

app.get("/health", (req, res) => {
  return res.status(200).json({ status: "ok" });
});

app.use("/api", routes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// The socket server shares this HTTP listener, so one port serves both the
// REST routes and the real-time namespace.
const server = http.createServer(app);
attachSocketServer(server, corsOrigins);

const PORT = process.env.PORT || 5012;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Gate Service running on port ${PORT}`);
});
