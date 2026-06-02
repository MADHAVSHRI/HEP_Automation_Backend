"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Rename entityFile -> workOrder
    await queryInterface.renameColumn(
      "Agents",
      "entityFile",
      "workOrder"
    );

    // Add licenseNumber
    await queryInterface.addColumn("Agents", "licenseNumber", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "",
    });

    // Add licenseValidityDate
    await queryInterface.addColumn(
      "Agents",
      "licenseValidityDate",
      {
        type: Sequelize.DATE,
        allowNull: true,
      }
    );

    // Add requisitionLetter
    await queryInterface.addColumn(
      "Agents",
      "requisitionLetter",
      {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "",
      }
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove added columns
    await queryInterface.removeColumn(
      "Agents",
      "requisitionLetter"
    );

    await queryInterface.removeColumn(
      "Agents",
      "licenseValidityDate"
    );

    await queryInterface.removeColumn(
      "Agents",
      "licenseNumber"
    );

    // Rename back workOrder -> entityFile
    await queryInterface.renameColumn(
      "Agents",
      "workOrder",
      "entityFile"
    );
  },
};