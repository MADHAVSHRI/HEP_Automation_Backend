"use strict";

const { all } = require("../src/routes");

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("pass_persons", {
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
        onUpdate: "CASCADE",
      },

      rateId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "hep_rates",
          key: "id",
        },
        onDelete: "RESTRICT",
      },

      hepTypeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "hep_types",
          key: "id",
        },
      },

      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      aadharNo: {
        type: Sequelize.STRING(12),
        unique: true,
        allowNull: false,
      },

      aadharPDFFilePATH: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      aadharPDFFileName: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      mobile: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },

      email: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      nationality: {
        type: Sequelize.ENUM("INDIAN", "FOREIGNER"),
        defaultValue: "INDIAN",
      },

      countryId: {
        type: Sequelize.INTEGER,
        references: {
          model: "countries",
          key: "id",
        },
      },

      visaNo: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      designationId: {
        type: Sequelize.INTEGER,
        references: {
          model: "designations",
          key: "id",
        },
      },

      designationOther: {
        type: Sequelize.STRING(100),
      },

      cardNumber: {
        type: Sequelize.STRING(50),
      },

      accessAreaId: {
        type: Sequelize.ENUM("OIL JETTY AND OTHER GATES", "OTHER GATES ONLY"),
        allowNull: false,
        defaultValue: "OTHER GATES ONLY",
      },

      withTwoWheeler: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      vehicleNo: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },

      idProofType: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      idProofNumber: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      idProofFilePath: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },

      idProofFileName: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      photoFilePath: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },

      photoFileName: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      passType: {
        type: Sequelize.ENUM("DAILY", "MONTHLY", "YEARLY"),
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

    // Performance indexes

    await queryInterface.addIndex("pass_persons", ["passRequestId"], {
      name: "idx_pass_persons_passRequestId",
    });
    await queryInterface.addIndex("pass_persons", ["rateId"], {
      name: "idx_pass_persons_rateId",
    });
    await queryInterface.addIndex("pass_persons", ["hepTypeId"], {
      name: "idx_pass_persons_hepTypeId",
    });
    await queryInterface.addIndex("pass_persons", ["designationId"], {
      name: "idx_pass_persons_designationId",
    });
    await queryInterface.addIndex("pass_persons", ["countryId"], {
      name: "idx_pass_persons_countryId",
    });

    await queryInterface.addIndex("pass_persons", ["dateFrom", "dateTo"], {
      name: "idx_pass_persons_dateRange",
    });
    await queryInterface.addIndex("pass_persons", ["aadharNo"], {
      name: "idx_pass_persons_aadharNo",
    });
    await queryInterface.addIndex("pass_persons", ["mobile"], {
      name: "idx_pass_persons_mobile",
    });
    await queryInterface.addIndex("pass_persons", ["cardNumber"], {
      name: "idx_pass_persons_cardNumber",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("pass_persons");
  },
};
