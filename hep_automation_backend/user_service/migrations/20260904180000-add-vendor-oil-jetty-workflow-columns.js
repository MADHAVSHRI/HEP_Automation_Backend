"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "vendor_pass_requests",
      "workflowActionStage",
      {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
    );

    await queryInterface.addColumn(
      "vendor_pass_requests",
      "workflowActionRemarks",
      {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "vendor_pass_requests",
      "workflowActionRemarks",
    );

    await queryInterface.removeColumn(
      "vendor_pass_requests",
      "workflowActionStage",
    );
  },
};
