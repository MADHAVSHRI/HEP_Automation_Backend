"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("material_pass_request", "requisitionLetterFilePath", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("material_pass_request", "requisitionLetterFileName", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("material_pass_request", "workOrderFilePath", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("material_pass_request", "workOrderFileName", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("material_pass_request", "requisitionLetterFilePath");
    await queryInterface.removeColumn("material_pass_request", "requisitionLetterFileName");
    await queryInterface.removeColumn("material_pass_request", "workOrderFilePath");
    await queryInterface.removeColumn("material_pass_request", "workOrderFileName");
  },
};