"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_pass_requests_status"
      ADD VALUE 'COMPLETED';
    `);
  },

  async down(queryInterface, Sequelize) {
    // ENUM removal is complex in PostgreSQL
    // Usually not reverted
  },
};
