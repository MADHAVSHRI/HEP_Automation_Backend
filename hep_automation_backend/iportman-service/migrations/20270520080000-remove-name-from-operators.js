"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("weighbridge_operators", "name");
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("weighbridge_operators", "name", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "",
    });
  },
};
