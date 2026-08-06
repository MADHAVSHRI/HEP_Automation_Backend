"use strict";

/**
 * Migration: Add driver license fields to bulk_pass_persons
 *
 * Adds:
 *  - driverLicenseNumber  (TEXT, nullable) — the DL number entered by the applicant
 *  - driverLicensePath    (TEXT, nullable) — path to the uploaded DL document
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("bulk_pass_persons", "driverLicenseNumber", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });

    await queryInterface.addColumn("bulk_pass_persons", "driverLicensePath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("bulk_pass_persons", "driverLicensePath");
    await queryInterface.removeColumn("bulk_pass_persons", "driverLicenseNumber");
  },
};
