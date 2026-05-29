"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("vendor_pass_requests", "submittedPersons");
    await queryInterface.removeColumn("vendor_pass_requests", "submittedVehicles");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("vendor_pass_requests", "submittedPersons", {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_requests", "submittedVehicles", {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },
};
