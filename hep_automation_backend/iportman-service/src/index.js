const express = require("express");
require("dotenv").config();
const cors = require("cors");
const loggerMiddleware = require("./middlewares/loggerMiddleware");
const { connectDB } = require("./dbconfig/db");
const routes = require("./routes/index");
const allowCredentials = require("../config/allowCredentials");
const corsConfig = require("../config/corsConfig");

const app = express();
// app.use(allowCredentials);
// corsConfig(app);
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
app.use("/api", routes);
const PORT = process.env.PORT || 5008;

app.listen(PORT, () => {
  console.log(`IPORTMAN Service running on port ${PORT}`);
});