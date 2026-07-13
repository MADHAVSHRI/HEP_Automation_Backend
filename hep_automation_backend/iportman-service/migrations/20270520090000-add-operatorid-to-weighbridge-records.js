"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("weighbridge_records", "operatorId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "weighbridge_operators",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    // Backfill any existing rows with the earliest operator so the column can
    // be made non-nullable. New rows always get the id from the JWT.
    await queryInterface.sequelize.query(
      'UPDATE "weighbridge_records" SET "operatorId" = (SELECT MIN(id) FROM "weighbridge_operators") WHERE "operatorId" IS NULL',
    );

    await queryInterface.sequelize.query(
      'ALTER TABLE "weighbridge_records" ALTER COLUMN "operatorId" SET NOT NULL',
    );
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("weighbridge_records", "operatorId");
  },
};
