// const express = require("express");
// require("dotenv").config();
// const cors = require("cors");
// const loggerMiddleware = require("./middlewares/loggerMiddleware");
// const { connectDB } = require("./dbconfig/db");
// const routes = require("./routes/index");
// const allowCredentials = require("../config/allowCredentials");
// const corsConfig = require("../config/corsConfig");

// const app = express();
// // app.use(allowCredentials);
// // corsConfig(app);
// app.use(
//   cors({
//     origin: ["http://localhost:3000", "http://14.139.180.41:3000"],
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization", "x-service-name"],
//     credentials: true,
//   }),
// );
// app.use(express.json());
// app.use(loggerMiddleware);
// connectDB();
// app.use("/api", routes);
// const PORT = process.env.PORT || 5008;

// app.listen(PORT, () => {
//   console.log(`IPORTMAN Service running on port ${PORT}`);
// });

const express = require("express");
require("dotenv").config();
const cors = require("cors");

const loggerMiddleware = require("./middlewares/loggerMiddleware");
const { connectDB } = require("./dbconfig/db");
const routes = require("./routes/index");

const app = express();

/**
 * If running behind Nginx/Reverse Proxy
 */
app.set("trust proxy", true);

/**
 * Allowed Frontend Origins (Browser CORS)
 */
const allowedOrigins = [
  "http://localhost:3000",
  "http://14.139.180.41:3000",
];

/**
 * Allowed Client Public IPs
 * Replace these with your clients' public IP addresses.
 */
const allowedIPs = [
  "127.0.0.1",
  "::1",

  // Example
  "14.139.180.41",
  "152.57.88.46"

  // Add more client IPs here
  // "49.xxx.xxx.xxx",
  // "103.xxx.xxx.xxx",
];

/**
 * CORS
 */
app.use(
  cors({
    origin(origin, callback) {
      // Allow Postman/server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-service-name",
    ],
    credentials: true,
  })
);

/**
 * Parse JSON
 */
app.use(express.json());

/**
 * Logger
 */
app.use(loggerMiddleware);

/**
 * IP Whitelist Middleware
 */
app.use((req, res, next) => {
  // Express automatically respects X-Forwarded-For when trust proxy=true
  let clientIp = req.ip;

  // Remove IPv6 prefix if present
  clientIp = clientIp.replace("::ffff:", "");

  console.log(`Incoming IP: ${clientIp}`);

  // if (!allowedIPs.includes(clientIp)) {
  //   return res.status(403).json({
  //     success: false,
  //     message: "Access denied. Your IP is not whitelisted.",
  //   });
  // }

  next();
});

/**
 * Database
 */
connectDB();

/**
 * Routes
 */
app.use("/api", routes);

/**
 * 404
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/**
 * Global Error Handler
 */
app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 5008;

app.listen(PORT, () => {
  console.log(`IPORTMAN Service running on port ${PORT}`);
});