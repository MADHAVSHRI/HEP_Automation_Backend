const cron = require("node-cron");
const { pool } = require("../dbconfig/db");

const cleanupExpiredSessions = async () => {
  try {

    // Ensure index exists on "expiresAt" for this to be fast:
    // CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_expires_at
    //   ON refresh_tokens ("expiresAt");
    const result = await pool.query(`
      DELETE FROM refresh_tokens
      WHERE "expiresAt" < NOW()
    `);

    if (result.rowCount > 0) {
      console.log(`Expired sessions cleaned: ${result.rowCount}`);
    }

  } catch (error) {
    console.error("Session cleanup error:", error);
  }
};

/*
Runs every hour (reduced from every 30 min — sessions are 24h TTL,
hourly cleanup is sufficient and halves the DB load)
*/
cron.schedule("0 * * * *", cleanupExpiredSessions);