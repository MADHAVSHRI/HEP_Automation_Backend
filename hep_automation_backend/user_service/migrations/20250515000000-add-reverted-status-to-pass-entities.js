"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    /*
    =====================================================
    ADD "reverted" VALUE TO PASS_PERSONS STATUS ENUM
    =====================================================
    */

    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_pass_persons_status"
      ADD VALUE IF NOT EXISTS 'reverted';
    `);

    /*
    =====================================================
    ADD "reverted" VALUE TO PASS_VEHICLES STATUS ENUM
    =====================================================
    */

    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_pass_vehicles_status"
      ADD VALUE IF NOT EXISTS 'reverted';
    `);
  },

  async down(queryInterface, Sequelize) {
    /*
    IMPORTANT:
    PostgreSQL cannot remove enum values easily without recreating the enum.
    This migration cannot be rolled back for enum values.
    */
  },
};
