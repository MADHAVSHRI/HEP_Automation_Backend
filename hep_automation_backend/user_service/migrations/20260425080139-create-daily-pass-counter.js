"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("daily_pass_counters", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      date: { type: Sequelize.DATEONLY, unique: true },
      passRequestCounter: { type: Sequelize.INTEGER, defaultValue: 0 },
      personCounter: { type: Sequelize.INTEGER, defaultValue: 0 },
      vehicleCounter: { type: Sequelize.INTEGER, defaultValue: 0 },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("daily_pass_counters");
  },
};
