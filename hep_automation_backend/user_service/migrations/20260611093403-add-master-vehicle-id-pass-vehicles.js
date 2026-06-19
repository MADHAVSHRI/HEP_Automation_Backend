"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "pass_vehicles",
      "masterVehicleId",
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "master_vehicles",
          key: "id",
        },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      }
    );

    await queryInterface.addIndex(
      "pass_vehicles",
      ["masterVehicleId"],
      {
        name: "idx_pass_vehicles_masterVehicleId",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "pass_vehicles",
      "idx_pass_vehicles_masterVehicleId"
    );

    await queryInterface.removeColumn(
      "pass_vehicles",
      "masterVehicleId"
    );
  },
};