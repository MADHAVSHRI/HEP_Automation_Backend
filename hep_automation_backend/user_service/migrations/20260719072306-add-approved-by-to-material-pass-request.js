"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "material_pass_request",
      "approvedBy",
      {
        type: Sequelize.STRING(255),
        allowNull: true,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(
      "material_pass_request",
      "approvedBy"
    );
  },
};