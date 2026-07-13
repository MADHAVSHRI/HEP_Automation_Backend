"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("weighbridge_records", "weighDate", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn("weighbridge_records", "weighTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });

    // Backfill the new columns from the existing timestamp.
    await queryInterface.sequelize.query(
      'UPDATE "weighbridge_records" SET "weighDate" = "weighedAt"::date, "weighTime" = "weighedAt"::time',
    );

    await queryInterface.changeColumn("weighbridge_records", "weighDate", {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });
    await queryInterface.changeColumn("weighbridge_records", "weighTime", {
      type: Sequelize.TIME,
      allowNull: false,
    });

    await queryInterface.removeColumn("weighbridge_records", "weighedAt");
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("weighbridge_records", "weighedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      'UPDATE "weighbridge_records" SET "weighedAt" = ("weighDate" || \' \' || "weighTime")::timestamp',
    );
    await queryInterface.changeColumn("weighbridge_records", "weighedAt", {
      type: Sequelize.DATE,
      allowNull: false,
    });
    await queryInterface.removeColumn("weighbridge_records", "weighDate");
    await queryInterface.removeColumn("weighbridge_records", "weighTime");
  },
};
