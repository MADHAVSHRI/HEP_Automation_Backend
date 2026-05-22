"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("vendor_pass_vehicles", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      vendorPassRequestId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "vendor_pass_requests",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      vehiclePassNo: {
        type: Sequelize.STRING(60),
        allowNull: false,
        unique: true,
      },

      vehicleRegistrationNo: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      vehicleType: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      dateFrom: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      dateTo: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      scannedCopyFilePath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      scannedCopyFileName: {
        type: Sequelize.STRING(150),
        allowNull: true,
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

      taxFilePath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      taxFileName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      emissionFilePath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      emissionFileName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      passType: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },

      passPeriod: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },

      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },

      status: {
        type: Sequelize.ENUM("pending", "approved", "rejected"),
        defaultValue: "pending",
      },

      rejectedReason: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    await queryInterface.addIndex("vendor_pass_vehicles", ["vendorPassRequestId"], {
      name: "idx_vpv_vendor_pass_request_id",
    });
    await queryInterface.addIndex("vendor_pass_vehicles", ["vehiclePassNo"], {
      name: "idx_vpv_vehicle_pass_no",
    });
    await queryInterface.addIndex("vendor_pass_vehicles", ["status"], {
      name: "idx_vpv_status",
    });
    await queryInterface.addIndex("vendor_pass_vehicles", ["dateFrom", "dateTo"], {
      name: "idx_vpv_date_range",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("vendor_pass_vehicles");
  },
};
