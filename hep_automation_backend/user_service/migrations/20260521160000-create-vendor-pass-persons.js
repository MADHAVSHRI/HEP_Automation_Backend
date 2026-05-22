"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("vendor_pass_persons", {
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

      personPassNo: {
        type: Sequelize.STRING(60),
        allowNull: false,
        unique: true,
      },

      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      mobile: {
        type: Sequelize.STRING(15),
        allowNull: true,
      },

      aadharNo: {
        type: Sequelize.STRING(12),
        allowNull: true,
      },

      email: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      nationality: {
        type: Sequelize.ENUM("INDIAN", "FOREIGNER"),
        defaultValue: "INDIAN",
      },

      dateFrom: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      dateTo: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      photoFilePath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      photoFileName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      idProofFilePath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      idProofFileName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      aadharPDFFilePATH: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      aadharPDFFileName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      passportPath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      passportName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      requisitionLetterPath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      requisitionLetterName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      driverLicensePath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      driverLicenseName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      policeVerificationPath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      policeVerificationName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      employmentProofPath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      employmentProofName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      chaLicensePath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      chaLicenseName: {
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

    await queryInterface.addIndex("vendor_pass_persons", ["vendorPassRequestId"], {
      name: "idx_vpp_vendor_pass_request_id",
    });
    await queryInterface.addIndex("vendor_pass_persons", ["personPassNo"], {
      name: "idx_vpp_person_pass_no",
    });
    await queryInterface.addIndex("vendor_pass_persons", ["status"], {
      name: "idx_vpp_status",
    });
    await queryInterface.addIndex("vendor_pass_persons", ["dateFrom", "dateTo"], {
      name: "idx_vpp_date_range",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("vendor_pass_persons");
  },
};
