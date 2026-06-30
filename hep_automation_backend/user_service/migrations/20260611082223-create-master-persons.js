"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("master_persons", {
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
          model: "Agents",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      hepTypeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "hep_types",
          key: "id",
        },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },

      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      aadharNo: {
        type: Sequelize.STRING(12),
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
        allowNull: true,
        references: {
          model: "countries",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      visaNo: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      designationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "designations",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      designationOther: {
        type: Sequelize.STRING(100),
      },

      cardNumber: {
        type: Sequelize.STRING(50),
      },

      accessAreaId: {
        type: Sequelize.ENUM(
          "OIL JETTY AND OTHER GATES",
          "OTHER GATES ONLY"
        ),
        allowNull: false      },

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

      passportPath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      passportName: {
        type: Sequelize.STRING(150),
        allowNull: true,
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
      "master_persons",
      ["agentId"],
      { name: "idx_master_persons_agentId" }
    );

    await queryInterface.addIndex(
      "master_persons",
      ["hepTypeId"],
      { name: "idx_master_persons_hepTypeId" }
    );

    await queryInterface.addIndex(
      "master_persons",
      ["designationId"],
      { name: "idx_master_persons_designationId" }
    );

    await queryInterface.addIndex(
      "master_persons",
      ["countryId"],
      { name: "idx_master_persons_countryId" }
    );

    await queryInterface.addIndex(
      "master_persons",
      ["aadharNo"],
      { name: "idx_master_persons_aadharNo" }
    );

    await queryInterface.addIndex(
      "master_persons",
      ["mobile"],
      { name: "idx_master_persons_mobile" }
    );

    await queryInterface.addIndex(
      "master_persons",
      ["cardNumber"],
      { name: "idx_master_persons_cardNumber" }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("master_persons");
  },
};