"use strict";

const { all } = require("../src/routes");

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("pass_vehicles", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      passRequestId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "pass_requests",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      rateId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "hep_rates",
          key: "id",
        },
      },

      vehicleTypeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "vehicle_types",
          key: "id",
        },
      },

      registrationNo: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },

      rfidCardNumber: {
        type: Sequelize.STRING(50),
        unique: true,
      },

      scannedCopyFilePath: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },

      scannedCopyFileName: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      insuranceExpiry: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      rcValidity: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      accessAreaId: {
        type: Sequelize.ENUM("OIL JETTY AND OTHER GATES", "OTHER GATES ONLY"),
        allowNull: false,
      },

      passType: {
        type: Sequelize.ENUM("DAILY", "MONTHLY", "ANNUAL"),
        allowNull: false,
      },

      passPeriod: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      dateFrom: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      dateTo: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },

      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },

      isBlocked: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
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

    await queryInterface.addIndex("pass_vehicles", ["passRequestId"]);
    await queryInterface.addIndex("pass_vehicles", ["vehicleTypeId"]);
    await queryInterface.addIndex("pass_vehicles", ["registrationNo"]);
    await queryInterface.addIndex("pass_vehicles", ["rfidCardNumber"]);
    await queryInterface.addIndex("pass_vehicles", ["dateFrom", "dateTo"]);
    await queryInterface.addIndex("pass_vehicles", ["accessAreaId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("pass_vehicles");
  },
};
