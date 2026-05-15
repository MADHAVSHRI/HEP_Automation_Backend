"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("vendor_pass_requests", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      referenceNo: {
        type: Sequelize.STRING(60),
        allowNull: false,
        unique: true,
      },

      token: {
        type: Sequelize.STRING(96),
        allowNull: false,
        unique: true,
      },

      createdByUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
      },

      departmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      departmentName: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      visitorTypeId: { type: Sequelize.INTEGER, allowNull: true },
      visitorTypeOther: { type: Sequelize.STRING(150), allowNull: true },

      purposeOfVisitId: { type: Sequelize.INTEGER, allowNull: true },
      purposeOther: { type: Sequelize.STRING(150), allowNull: true },

      passApplyMode: {
        type: Sequelize.ENUM("SINGLE", "MULTIPLE"),
        defaultValue: "MULTIPLE",
      },

      companyName: { type: Sequelize.STRING(200), allowNull: false },
      vendorEmail: { type: Sequelize.STRING(150), allowNull: false },
      vendorMobile: { type: Sequelize.STRING(15), allowNull: false },

      hasWorkOrder: { type: Sequelize.BOOLEAN, defaultValue: false },
      refDocNo: { type: Sequelize.STRING(100), allowNull: true },
      workOrderFilePath: { type: Sequelize.STRING(500), allowNull: true },
      workOrderFileName: { type: Sequelize.STRING(300), allowNull: true },

      equipmentMaterialDetails: { type: Sequelize.TEXT, allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },

      noOfPersonsAllowed: { type: Sequelize.INTEGER, defaultValue: 0 },
      noOfVehiclesAllowed: { type: Sequelize.INTEGER, defaultValue: 0 },

      paymentMode: {
        type: Sequelize.ENUM("CASH", "FREE"),
        defaultValue: "CASH",
      },
      allowAuctionPassOnly: { type: Sequelize.BOOLEAN, defaultValue: false },

      validUpto: { type: Sequelize.DATEONLY, allowNull: false },

      status: {
        type: Sequelize.ENUM(
          "LINK_SENT",
          "VENDOR_SUBMITTED",
          "APPROVED",
          "REJECTED",
          "EXPIRED",
          "REVOKED"
        ),
        defaultValue: "LINK_SENT",
      },

      // Will be populated in the next slice when the vendor submits the
      // pass-application form. Kept nullable so this migration does not
      // depend on the pass_requests extension.
      passRequestId: { type: Sequelize.INTEGER, allowNull: true },

      submittedAt: { type: Sequelize.DATE, allowNull: true },
      lastEmailSentAt: { type: Sequelize.DATE, allowNull: true },

      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex("vendor_pass_requests", ["token"], {
      name: "idx_vpr_token",
    });
    await queryInterface.addIndex("vendor_pass_requests", ["status"], {
      name: "idx_vpr_status",
    });
    await queryInterface.addIndex("vendor_pass_requests", ["createdByUserId"], {
      name: "idx_vpr_created_by",
    });
    await queryInterface.addIndex("vendor_pass_requests", ["departmentId"], {
      name: "idx_vpr_dept",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("vendor_pass_requests");
  },
};
