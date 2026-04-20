const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("./jobs/sessionCleanUp");
const loggerMiddleware = require("./middlewares/loggerMiddleware");
const { connectDB } = require("./dbconfig/db");
const routes = require("./routes/index");
const allowCredentials = require("../config/allowCredentials");
const corsConfig = require("../config/corsConfig");

const app = express();
app.use(allowCredentials);
corsConfig(app);
// app.use(cors());
app.use(express.json());

app.use(loggerMiddleware);
connectDB();
app.use('/api', routes);

const PORT = process.env.PORT || 5006;

app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
