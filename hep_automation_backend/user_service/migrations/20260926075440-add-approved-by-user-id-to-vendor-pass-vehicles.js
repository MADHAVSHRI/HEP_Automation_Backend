"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    // ==========================================================
    // ADD SAFETY OFFICER APPROVER USER ID TO EACH VENDOR VEHICLE
    // ==========================================================

    await queryInterface.addColumn("vendor_pass_vehicles", "approvedByUserId", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // ==========================================================
    // INDEX
    // ==========================================================

    await queryInterface.addIndex(
      "vendor_pass_vehicles",
      ["approvedByUserId"],
      {
        name: "idx_vendor_pass_vehicles_approvedByUserId",
      },
    );
  },

  async down(queryInterface) {
    // ==========================================================
    // REMOVE INDEX
    // ==========================================================

    await queryInterface.removeIndex(
      "vendor_pass_vehicles",
      "idx_vendor_pass_vehicles_approvedByUserId",
    );

    // ==========================================================
    // REMOVE COLUMN
    // ==========================================================

    await queryInterface.removeColumn(
      "vendor_pass_vehicles",
      "approvedByUserId",
    );
  },
};
