const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const loggerMiddleware = require("./middlewares/loggerMiddleware");
const { connectDB } = require("./dbconfig/db");
const routes = require("./routes/index");
const corsConfig = require("../config/corsConfig");

const app = express();
corsConfig(app);
app.use(cors());
app.use(express.json());
app.use(loggerMiddleware);
connectDB();

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Health check — used by auth-service startup diagnostic
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.use("/api", routes);

const PORT = process.env.PORT || 5005;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Approval Admin Service running on port ${PORT}`);
});