"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("User_types", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      document_instruction: {
        type: Sequelize.TEXT,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("User_types");
  },
};
