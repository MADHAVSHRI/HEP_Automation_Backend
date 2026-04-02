const express = require("express");
const cors = require("cors");
require("dotenv").config();
const loggerMiddleware = require("./middlewares/loggerMiddleware");
// const { connectDB } = require("./dbconfig/db");
const startConsumer = require("./utils/kafka/consumer");
const routes = require("./routes/index");


const app = express();

app.use(cors());
app.use(express.json());

app.use(loggerMiddleware);
// connectDB();
startConsumer()
  .then(() => console.log("Kafka Consumer Started"))
  .catch(err => console.error("Kafka Consumer Error:", err));
app.use('/api', routes);

// app.use("/api/agents", agentRoutes);

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});
