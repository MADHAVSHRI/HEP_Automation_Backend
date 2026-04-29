"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // expiresAt: used in the hourly session cleanup DELETE query
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_expires_at
        ON refresh_tokens ("expiresAt");
    `);

    // sessionId: used on every authenticated request (getSessionBySessionId)
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_session_id
        ON refresh_tokens ("sessionId");
    `);

    // userId: used in session lookup during login
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_user_id
        ON refresh_tokens ("userId");
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_refresh_tokens_expires_at;`
    );
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_refresh_tokens_session_id;`
    );
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_refresh_tokens_user_id;`
    );
  },
};
