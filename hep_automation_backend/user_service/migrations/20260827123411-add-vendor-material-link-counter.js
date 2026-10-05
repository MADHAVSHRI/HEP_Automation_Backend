"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "daily_pass_counters",
      "vendorMaterialLinkCounter",
      {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      }
    );

    await queryInterface.addColumn(
      "daily_pass_counters",
      "vendorMaterialRequestCounter",
      {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "daily_pass_counters",
      "vendorMaterialRequestCounter"
    );

    await queryInterface.removeColumn(
      "daily_pass_counters",
      "vendorMaterialLinkCounter"
    );
  },
};