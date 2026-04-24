"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add status to pass_persons
    await queryInterface.addColumn("pass_persons", "status", {
      type: Sequelize.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    });

    // Add status to pass_vehicles
    await queryInterface.addColumn("pass_vehicles", "status", {
      type: Sequelize.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("pass_persons", "status");

    await queryInterface.removeColumn("pass_vehicles", "status");
  },
};
