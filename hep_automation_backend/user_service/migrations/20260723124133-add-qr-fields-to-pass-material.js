"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pass_material", "qrIssuedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("pass_material", "qrRevoked", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("pass_material", "qrPdfPath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("pass_material", "qrPdfPath");
    await queryInterface.removeColumn("pass_material", "qrRevoked");
    await queryInterface.removeColumn("pass_material", "qrIssuedAt");
  },
};