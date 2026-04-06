const { pool } = require("../dbconfig/db");

const RefreshToken = {

  async createSession({ userId, refreshToken, sessionId }) {

    const query = `
      INSERT INTO "refresh_tokens"
      ("userId","refreshToken","sessionId","expiresAt")
      VALUES ($1,$2,$3, NOW() + INTERVAL '7 days')
      ON CONFLICT ("userId")
      DO UPDATE
      SET
        "refreshToken" = EXCLUDED."refreshToken",
        "sessionId" = EXCLUDED."sessionId",
        "expiresAt" = EXCLUDED."expiresAt"
    `;

    await pool.query(query, [userId, refreshToken, sessionId]);

  },

  async getSession(userId) {

    const query = `
      SELECT *
      FROM "refresh_tokens"
      WHERE "userId"=$1
    `;

    const result = await pool.query(query,[userId]);

    return result.rows[0];

  },

  async deleteUserSessions(userId){

    const query = `
      DELETE FROM "refresh_tokens"
      WHERE "userId"=$1
    `;

    await pool.query(query,[userId]);

  }

};

module.exports = RefreshToken;