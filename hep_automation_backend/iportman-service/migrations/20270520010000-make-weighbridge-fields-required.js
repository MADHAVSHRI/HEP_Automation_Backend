"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("weighbridge_records", "cargo", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn("weighbridge_records", "clientName", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("weighbridge_records", "cargo", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn("weighbridge_records", "clientName", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
