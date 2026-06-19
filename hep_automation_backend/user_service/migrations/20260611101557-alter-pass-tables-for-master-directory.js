"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {

    /*
    ==========================
    PASS PERSONS
    ==========================
    */

    await queryInterface.changeColumn("pass_persons", "name", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_persons", "aadharNo", {
      type: Sequelize.STRING(12),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_persons", "aadharPDFFilePATH", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_persons", "aadharPDFFileName", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_persons", "mobile", {
      type: Sequelize.STRING(10),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_persons", "email", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_persons", "accessAreaId", {
      type: Sequelize.ENUM(
        "OIL JETTY AND OTHER GATES",
        "OTHER GATES ONLY"
      ),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_persons", "withTwoWheeler", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_persons", "idProofType", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_persons", "idProofNumber", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_persons", "idProofFilePath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_persons", "idProofFileName", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_persons", "photoFilePath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_persons", "photoFileName", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    /*
    ==========================
    PASS VEHICLES
    ==========================
    */

    await queryInterface.changeColumn("pass_vehicles", "registrationNo", {
      type: Sequelize.STRING(20),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_vehicles", "scannedCopyFilePath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_vehicles", "scannedCopyFileName", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_vehicles", "insuranceExpiry", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_vehicles", "rcValidity", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.changeColumn("pass_vehicles", "accessAreaId", {
      type: Sequelize.ENUM(
        "OIL JETTY AND OTHER GATES",
        "OTHER GATES ONLY"
      ),
      allowNull: true,
    });

  },

  async down(queryInterface, Sequelize) {
    // no rollback
  },
};