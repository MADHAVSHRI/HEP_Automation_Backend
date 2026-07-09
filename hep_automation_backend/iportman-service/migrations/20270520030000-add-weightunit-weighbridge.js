"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("weighbridge_records", "weightUnit", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "kg",
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("weighbridge_records", "weightUnit");
  },
};
