const cron = require("node-cron");
const { pool } = require("../dbconfig/db");

const cleanupExpiredSessions = async () => {
  try {

    const result = await pool.query(`
      DELETE FROM refresh_tokens
      WHERE "expiresAt" < NOW()
    `);

    console.log(`Expired sessions cleaned: ${result.rowCount}`);

  } catch (error) {
    console.error("Session cleanup error:", error);
  }
};

/*
Runs every 30 minutes
*/
cron.schedule("*/30 * * * *", cleanupExpiredSessions);