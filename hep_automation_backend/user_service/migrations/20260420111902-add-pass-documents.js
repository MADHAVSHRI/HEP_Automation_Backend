"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    /* PERSON FILES */

    await queryInterface.addColumn("pass_persons", "driverLicensePath", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("pass_persons", "driverLicenseName", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("pass_persons", "policeVerificationPath", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("pass_persons", "policeVerificationName", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("pass_persons", "employmentProofPath", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("pass_persons", "employmentProofName", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("pass_persons", "chaLicensePath", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("pass_persons", "chaLicenseName", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("pass_persons", "passportPath", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("pass_persons", "passportName", {
      type: Sequelize.STRING,
    });

    /* VEHICLE FILES */

    await queryInterface.addColumn("pass_vehicles", "insuranceFilePath", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("pass_vehicles", "insuranceFileName", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("pass_vehicles", "permitFilePath", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("pass_vehicles", "permitFileName", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("pass_vehicles", "fitnessFilePath", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("pass_vehicles", "fitnessFileName", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("pass_vehicles", "requestLetterPath", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("pass_vehicles", "requestLetterName", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("pass_vehicles", "taxDocPath", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("pass_vehicles", "taxDocName", {
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn("pass_vehicles", "emissionCertPath", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("pass_vehicles", "emissionCertName", {
      type: Sequelize.STRING,
    });
  },

  async down(queryInterface) {},
};
