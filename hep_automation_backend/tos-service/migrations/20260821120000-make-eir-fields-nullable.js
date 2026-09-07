"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("tos_eir_records", "outGateDateTime", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.changeColumn("tos_eir_records", "oocStatus", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn("tos_eir_records", "destinationName", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn("tos_eir_records", "markedForScanning", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("tos_eir_records", "outGateDateTime", {
      type: Sequelize.DATE,
      allowNull: false,
    });
    await queryInterface.changeColumn("tos_eir_records", "oocStatus", {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.changeColumn("tos_eir_records", "destinationName", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn("tos_eir_records", "markedForScanning", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
