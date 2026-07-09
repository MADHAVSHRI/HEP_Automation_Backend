"use strict";

const { MOVEMENT_TYPE_LIST } = require("../src/constants/constants");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("weighbridge_records", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      weighBridgeName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      serialNo: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      weighedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      vehicleNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      movementType: {
        type: Sequelize.ENUM(...MOVEMENT_TYPE_LIST),
        allowNull: false,
      },
      cargo: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      clientName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      grossWeight: {
        type: Sequelize.DECIMAL,
        allowNull: false,
      },
      tareWeight: {
        type: Sequelize.DECIMAL,
        allowNull: false,
      },
      netWeight: {
        type: Sequelize.DECIMAL,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("weighbridge_records");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_weighbridge_records_movementType";',
    );
  },
};
