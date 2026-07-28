"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("vvip_pass_requests", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      referenceNo: {
        type: Sequelize.STRING(40),
        allowNull: false,
        unique: true,
      },
      createdByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      departmentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      departmentName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      visitPurpose: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      visitDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      validityFrom: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      validityTo: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      noOfPasses: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("UNDER_REVIEW", "APPROVED", "REJECTED", "RETURNED"),
        allowNull: false,
        defaultValue: "UNDER_REVIEW",
      },
      approvedBy: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      approvedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      rejectedReason: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    await queryInterface.createTable("vvip_pass_persons", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      requestId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "vvip_pass_requests",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      designation: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      mobile: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      idProofType: {
        type: Sequelize.STRING(60),
        allowNull: true,
      },
      idProofNo: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      idProofFilePath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      documentPath: {
        type: Sequelize.STRING(500),
        allowNull: true,
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

    await queryInterface.createTable("vvip_pass_vehicles", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      requestId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "vvip_pass_requests",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      vehicleNo: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      vehicleType: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      driverName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      driverMobile: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      documentPath: {
        type: Sequelize.STRING(500),
        allowNull: true,
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

    await queryInterface.addIndex("vvip_pass_requests", ["status"]);
    await queryInterface.addIndex("vvip_pass_requests", ["createdByUserId"]);
    await queryInterface.addIndex("vvip_pass_persons", ["requestId"]);
    await queryInterface.addIndex("vvip_pass_vehicles", ["requestId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("vvip_pass_vehicles");
    await queryInterface.dropTable("vvip_pass_persons");
    await queryInterface.dropTable("vvip_pass_requests");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_vvip_pass_requests_status";',
    );
  },
};
