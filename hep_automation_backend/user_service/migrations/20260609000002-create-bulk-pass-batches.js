"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("bulk_pass_batches", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      refNo: {
        type: Sequelize.STRING(60),
        allowNull: false,
        unique: true,
      },

      token: {
        type: Sequelize.STRING(96),
        allowNull: false,
        unique: true,
      },

      tokenActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },

      createdByUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      departmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      departmentName: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      visitorType: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      companyName: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },

      applicantEmail: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      applicantMobile: {
        type: Sequelize.STRING(15),
        allowNull: false,
      },

      refDocNo: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      workOrderRequired: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      noOfPersons: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },

      noOfVehicles: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },

      paymentMode: {
        type: Sequelize.ENUM("CASH", "FREE"),
        defaultValue: "CASH",
      },

      passType: {
        type: Sequelize.ENUM("MULTIPLE", "SINGLE"),
        defaultValue: "MULTIPLE",
      },

      purpose: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      validityUpto: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM(
          "DRAFT",
          "SUBMITTED",
          "UNDER_REVIEW",
          "RETURNED_TO_APPLICANT",
          "REJECTED",
          "COMPLETED"
        ),
        defaultValue: "DRAFT",
      },

      returnReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      rejectionReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      qrPdfPath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      submittedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      lastEmailSentAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("bulk_pass_batches", ["token"], {
      name: "idx_bpb_token",
    });
    await queryInterface.addIndex("bulk_pass_batches", ["status"], {
      name: "idx_bpb_status",
    });
    await queryInterface.addIndex("bulk_pass_batches", ["createdByUserId"], {
      name: "idx_bpb_created_by",
    });
    await queryInterface.addIndex("bulk_pass_batches", ["departmentId"], {
      name: "idx_bpb_dept",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("bulk_pass_batches");
  },
};
