"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("vendor_pass_requests", "submittedPersons", {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn("vendor_pass_requests", "submittedVehicles", {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("vendor_pass_requests", "submittedPersons");
    await queryInterface.removeColumn("vendor_pass_requests", "submittedVehicles");
  },
};
