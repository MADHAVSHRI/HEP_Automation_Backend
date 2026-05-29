"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Missing columns in vendor_pass_persons
    await queryInterface.addColumn("vendor_pass_persons", "rateId", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "hepTypeId", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "designationId", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "designationOther", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "idProofType", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "idProofNumber", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "countryId", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "accessAreaId", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "cardNumber", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "visaNo", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "passportNo", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "cdcNumber", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "seafarerPassFor", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "seafarerIdType", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "withTwoWheeler", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });
    await queryInterface.addColumn("vendor_pass_persons", "vehicleNo", {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "cdcDocumentPath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "cdcDocumentName", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "declarationFormPath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_persons", "declarationFormName", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    // Missing columns in vendor_pass_vehicles
    await queryInterface.addColumn("vendor_pass_vehicles", "rateId", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_vehicles", "vehicleTypeId", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_vehicles", "fuelType", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_vehicles", "insuranceExpiry", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_vehicles", "rcValidity", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_vehicles", "accessAreaId", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Rollback for vendor_pass_persons
    await queryInterface.removeColumn("vendor_pass_persons", "rateId");
    await queryInterface.removeColumn("vendor_pass_persons", "hepTypeId");
    await queryInterface.removeColumn("vendor_pass_persons", "designationId");
    await queryInterface.removeColumn("vendor_pass_persons", "designationOther");
    await queryInterface.removeColumn("vendor_pass_persons", "idProofType");
    await queryInterface.removeColumn("vendor_pass_persons", "idProofNumber");
    await queryInterface.removeColumn("vendor_pass_persons", "countryId");
    await queryInterface.removeColumn("vendor_pass_persons", "accessAreaId");
    await queryInterface.removeColumn("vendor_pass_persons", "cardNumber");
    await queryInterface.removeColumn("vendor_pass_persons", "visaNo");
    await queryInterface.removeColumn("vendor_pass_persons", "passportNo");
    await queryInterface.removeColumn("vendor_pass_persons", "cdcNumber");
    await queryInterface.removeColumn("vendor_pass_persons", "seafarerPassFor");
    await queryInterface.removeColumn("vendor_pass_persons", "seafarerIdType");
    await queryInterface.removeColumn("vendor_pass_persons", "withTwoWheeler");
    await queryInterface.removeColumn("vendor_pass_persons", "vehicleNo");
    await queryInterface.removeColumn("vendor_pass_persons", "cdcDocumentPath");
    await queryInterface.removeColumn("vendor_pass_persons", "cdcDocumentName");
    await queryInterface.removeColumn("vendor_pass_persons", "declarationFormPath");
    await queryInterface.removeColumn("vendor_pass_persons", "declarationFormName");

    // Rollback for vendor_pass_vehicles
    await queryInterface.removeColumn("vendor_pass_vehicles", "rateId");
    await queryInterface.removeColumn("vendor_pass_vehicles", "vehicleTypeId");
    await queryInterface.removeColumn("vendor_pass_vehicles", "fuelType");
    await queryInterface.removeColumn("vendor_pass_vehicles", "insuranceExpiry");
    await queryInterface.removeColumn("vendor_pass_vehicles", "rcValidity");
    await queryInterface.removeColumn("vendor_pass_vehicles", "accessAreaId");
  },
};
