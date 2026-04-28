"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    /*
    =====================================================
    ADD "reverted" VALUE TO ENUM
    =====================================================
    */

    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Agents_status"
      ADD VALUE IF NOT EXISTS 'reverted';
    `);

    /*
    =====================================================
    ADD INDEX FOR STATUS COLUMN
    =====================================================
    */

    await queryInterface.addIndex("Agents", ["status"], {
      name: "idx_agents_status",
    });
  },

  async down(queryInterface, Sequelize) {
    /*
    IMPORTANT:
    PostgreSQL cannot remove enum values easily.
    So we only remove the index in rollback.
    */

    await queryInterface.removeIndex("Agents", "idx_agents_status");
  },
};
