"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_pass_requests_status"
      ADD VALUE 'REVERTED';
    `);
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL doesn't support removing enum values directly
    // This migration cannot be reversed without recreating the enum
    console.log("Note: Cannot remove 'REVERTED' from enum without recreating it");
  }
};
