"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_vendor_pass_requests_status"
      ADD VALUE IF NOT EXISTS 'REVERTED';
    `);

    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_vendor_pass_requests_status"
      ADD VALUE IF NOT EXISTS 'COMPLETED';
    `);
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL enum rollback is unsafe
  },
};
