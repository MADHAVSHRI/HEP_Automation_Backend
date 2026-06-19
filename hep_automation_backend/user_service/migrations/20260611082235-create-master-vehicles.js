"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("master_vehicles", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      agentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      vehicleTypeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "vehicle_types",
          key: "id",
        },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },

      registrationNo: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      rfidCardNumber: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      scannedCopyFilePath: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },

      scannedCopyFileName: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      insuranceFilePath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      insuranceFileName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      permitFilePath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      permitFileName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      fitnessFilePath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      fitnessFileName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      requestLetterPath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      requestLetterName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      taxDocPath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      taxDocName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      emissionCertPath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      emissionCertName: {
        type: Sequelize.STRING(150),
        allowNull: true,
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
        type: Sequelize.ENUM(
          "OIL JETTY AND OTHER GATES",
          "OTHER GATES ONLY"
        ),
        allowNull: false,
      },

      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex(
      "master_vehicles",
      ["agentId"],
      {
        name: "idx_master_vehicles_agentId",
      }
    );

    await queryInterface.addIndex(
      "master_vehicles",
      ["vehicleTypeId"],
      {
        name: "idx_master_vehicles_vehicleTypeId",
      }
    );

    await queryInterface.addIndex(
      "master_vehicles",
      ["registrationNo"],
      {
        name: "idx_master_vehicles_registrationNo",
      }
    );

    await queryInterface.addIndex(
      "master_vehicles",
      ["accessAreaId"],
      {
        name: "idx_master_vehicles_accessAreaId",
      }
    );

    await queryInterface.addIndex(
      "master_vehicles",
      ["insuranceExpiry"],
      {
        name: "idx_master_vehicles_insuranceExpiry",
      }
    );

    await queryInterface.addIndex(
      "master_vehicles",
      ["rcValidity"],
      {
        name: "idx_master_vehicles_rcValidity",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("master_vehicles");
  },
};