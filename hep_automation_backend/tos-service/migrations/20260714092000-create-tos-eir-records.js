"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("tos_eir_records", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      eirNo: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      terminal: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      inGateDateTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      outGateDateTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      containerNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      containerISO: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      containerSize: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      movementType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      fullEmpty: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      line: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      trailerNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      oocStatus: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      destinationGroup: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      destinationName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      markedForScanning: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "tos_operators",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
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
    await queryInterface.dropTable("tos_eir_records");
  },
};
