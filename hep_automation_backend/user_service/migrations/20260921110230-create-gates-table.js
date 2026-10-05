"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("gates", {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      gateName: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },

      gateCode: {
        type: Sequelize.STRING(30),
        allowNull: true,
        unique: true,
      },

      description: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("gates");
  },
};