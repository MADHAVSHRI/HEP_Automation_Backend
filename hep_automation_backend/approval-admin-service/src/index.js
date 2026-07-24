const express = require("express");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");
require("dotenv").config();
const loggerMiddleware = require("./middlewares/loggerMiddleware");
const { connectDB } = require("./dbconfig/db");
const routes = require("./routes/index");
const corsConfig = require("../config/corsConfig");
const Overstay = require("./models/overstaySchema");
const Blacklist = require("./models/blacklistSchema");
const overstayEmailJob = require("./jobs/overstayEmailJob");

const app = express();
corsConfig(app);
app.use(cors());

// Disable Express fingerprinting — removes "X-Powered-By: Express" header
app.disable("x-powered-by");
app.use(express.json());
app.use(loggerMiddleware);
connectDB();

// Initialise overstay_charges table (idempotent)
Overstay.initTable()
  .then(() => console.log("overstay_charges table ready"))
  .catch((err) => console.error("overstay_charges init error:", err.message));

// Initialise blacklist_penalty_config table (idempotent — seeds reason codes 001-007)
Blacklist.initPenaltyConfigTable()
  .then(() => console.log("blacklist_penalty_config table ready"))
  .catch((err) => console.error("blacklist_penalty_config init error:", err.message));

// Schedule daily overstay reminder emails at 09:00 AM
cron.schedule("0 9 * * *", overstayEmailJob, {
  scheduled: true,
  timezone: "Asia/Kolkata",
});

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Health check — used by auth-service startup diagnostic
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.use("/api", routes);

const PORT = process.env.PORT || 5005;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Approval Admin Service running on port ${PORT}`);
});