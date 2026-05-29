"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    /* =========================================
       ENUMS
    ========================================= */

    // Add reverted to vendor pass persons enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_vendor_pass_persons_status"
      ADD VALUE IF NOT EXISTS 'reverted';
    `);

    // Add reverted to vendor pass vehicles enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_vendor_pass_vehicles_status"
      ADD VALUE IF NOT EXISTS 'reverted';
    `);

    /* =========================================
       PERSONS TABLE
    ========================================= */

    await queryInterface.addColumn(
      "vendor_pass_persons",
      "revertReason",
      {
        type: Sequelize.TEXT,
        allowNull: true,
      }
    );

    await queryInterface.addColumn(
      "vendor_pass_persons",
      "revertedAt",
      {
        type: Sequelize.DATE,
        allowNull: true,
      }
    );

    /* =========================================
       VEHICLES TABLE
    ========================================= */

    await queryInterface.addColumn(
      "vendor_pass_vehicles",
      "revertReason",
      {
        type: Sequelize.TEXT,
        allowNull: true,
      }
    );

    await queryInterface.addColumn(
      "vendor_pass_vehicles",
      "revertedAt",
      {
        type: Sequelize.DATE,
        allowNull: true,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    /* =========================================
       PERSONS TABLE
    ========================================= */

    await queryInterface.removeColumn(
      "vendor_pass_persons",
      "revertReason"
    );

    await queryInterface.removeColumn(
      "vendor_pass_persons",
      "revertedAt"
    );

    /* =========================================
       VEHICLES TABLE
    ========================================= */

    await queryInterface.removeColumn(
      "vendor_pass_vehicles",
      "revertReason"
    );

    await queryInterface.removeColumn(
      "vendor_pass_vehicles",
      "revertedAt"
    );
  },
};