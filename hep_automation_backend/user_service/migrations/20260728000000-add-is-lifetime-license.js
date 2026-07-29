"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Agents", "isLifetimeLicense", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn("AgentProfileUpdateRequests", "isLifetimeLicense", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Agents", "isLifetimeLicense");
    await queryInterface.removeColumn("AgentProfileUpdateRequests", "isLifetimeLicense");
  },
};
