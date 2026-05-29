"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    /*
    =====================================================
    ADD COLUMNS TO TRACK REVERT STATUS ON PASS REQUESTS
    =====================================================
    */

    // Flag to indicate if pass has any reverted entities
    await queryInterface.addColumn("pass_requests", "hasRevertedEntities", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });

    // Track how many times this pass has been reverted
    await queryInterface.addColumn("pass_requests", "revertCount", {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    });

    // Track when last revert happened
    await queryInterface.addColumn("pass_requests", "lastRevertedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Add index for filtering reverted passes
    await queryInterface.addIndex("pass_requests", ["hasRevertedEntities"], {
      name: "idx_pass_requests_has_reverted",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("pass_requests", "idx_pass_requests_has_reverted");
    await queryInterface.removeColumn("pass_requests", "hasRevertedEntities");
    await queryInterface.removeColumn("pass_requests", "revertCount");
    await queryInterface.removeColumn("pass_requests", "lastRevertedAt");
  },
};
