"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "vendor_pass_vehicles",
      "concernDepartmentId",
      {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "vendor_pass_vehicles",
      "concernDepartmentId",
    );
  },
};