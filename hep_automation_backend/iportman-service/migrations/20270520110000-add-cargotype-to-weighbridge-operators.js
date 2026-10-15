"use strict";

// Cargo handled at the weighbridge: LiquidBulk, DryBulk or BlockBulk.
// Nullable so existing operator rows stay valid; values are validated in the model.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("weighbridge_operators", "cargoType", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("weighbridge_operators", "cargoType");
  },
};
