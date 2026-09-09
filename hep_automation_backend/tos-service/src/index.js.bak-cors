const express = require("express");
require("dotenv").config();
const cors = require("cors");

const loggerMiddleware = require("./middlewares/loggerMiddleware");
const { connectDB } = require("./dbconfig/db");
const routes = require("./routes/index");

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "http://14.139.180.41:3000"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-service-name"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(loggerMiddleware);
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

const PORT = process.env.PORT || 5009;

app.listen(PORT, () => {
  console.log(`TOS Service running on port ${PORT}`);
});