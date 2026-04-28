const express = require("express");
const cors = require("cors");
require("dotenv").config();
const loggerMiddleware = require("./middlewares/loggerMiddleware");
const { connectDB } = require("./dbconfig/db");
const routes = require("./routes/index");
const allowCredentials = require("../config/allowCredentials");
const corsConfig = require("../config/corsConfig");
const initUploadDirs = require("./utils/initUploadDir");

const app = express();
app.use(allowCredentials);
corsConfig(app);
// app.use(cors());
app.use(
  cors({
    // 1. Allowed your specific frontend ports
    origin: ["http://localhost:3000", "http://172.20.10.2:3000"],

    // 2. Explicitly allowed the PATCH method (which was previously blocked)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    // 3. Explicitly allowed your custom backend headers
    allowedHeaders: ["Content-Type", "Authorization", "x-service-name"],

    credentials: true,
  }),
);

initUploadDirs();

app.use(express.json());

app.use(loggerMiddleware);
connectDB();
app.use("/api", routes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});
