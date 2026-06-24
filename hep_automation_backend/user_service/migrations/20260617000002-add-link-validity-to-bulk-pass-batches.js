"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // How long the applicant upload link stays valid, in hours (24 or 48).
    await queryInterface.addColumn("bulk_pass_batches", "linkValidityHours", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 48,
    });
    // Absolute timestamp after which the upload link is considered expired.
    // Nullable so pre-existing batches (no expiry) keep working.
    await queryInterface.addColumn("bulk_pass_batches", "tokenExpiresAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("bulk_pass_batches", "tokenExpiresAt");
    await queryInterface.removeColumn("bulk_pass_batches", "linkValidityHours");
  },
};
