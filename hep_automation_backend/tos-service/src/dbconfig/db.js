const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT ? Number(process.env.PG_PORT) : undefined,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("TOS-Service unexpected PostgreSQL pool error:", err.message);
});

const connectDB = async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log("PostgreSQL Connected Successfully");
  } catch (error) {
    console.error("PostgreSQL Connection Failed:", error.message);
    process.exit(1);
  }
};

module.exports = { pool, connectDB };
