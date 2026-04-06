const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT ? Number(process.env.PG_PORT) : undefined,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

const connectDB = async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log("Auth-Service PostgreSQL Connected Successfully");
  } catch (error) {
    console.error("Auth-Service PostgreSQL Connection Failed:", error.message);
    process.exit(1);
  }
};

module.exports = { pool, connectDB };









































// const mongoose = require("mongoose");

// const connectDB = async () => {
//   try {
//     const mongoUri = process.env.MONGO_URI;
//     if (!mongoUri) {
//       console.error("MONGO_URI environment variable is not set");
//       process.exit(1);
//     }
//     await mongoose.connect(mongoUri);

//     console.log("MongoDB Connected Successfully");
//   } catch (error) {
//     console.error("MongoDB Connection Failed:", error.message);
//     process.exit(1);
//   }
// };

// module.exports = connectDB;




