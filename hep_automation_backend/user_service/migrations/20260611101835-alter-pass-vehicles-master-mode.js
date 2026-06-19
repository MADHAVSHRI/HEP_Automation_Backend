"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.changeColumn(
      "pass_vehicles",
      "vehicleTypeId",
      {
        type: Sequelize.INTEGER,
        allowNull: true,
      }
    );

  },

  async down() {}
};