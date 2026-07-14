"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update existing data
    await queryInterface.sequelize.query(`
      UPDATE "bulk_pass_batches"
      SET "status" = 'UNDER_REVIEW'
      WHERE "status" = 'SUBMITTED';
    `);

    await queryInterface.sequelize.query(`
      UPDATE "bulk_pass_status_logs"
      SET "status" = 'UNDER_REVIEW'
      WHERE "status" = 'SUBMITTED';
    `);

    // Rename old type, create new type without SUBMITTED
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_bulk_pass_batches_status"
      RENAME TO "enum_bulk_pass_batches_status_old";

      CREATE TYPE "enum_bulk_pass_batches_status" AS ENUM (
        'DRAFT',
        'UNDER_REVIEW',
        'RETURNED_TO_APPLICANT',
        'REJECTED',
        'COMPLETED'
      );
    `);

    // Convert bulk_pass_batches.status to the new type
    await queryInterface.sequelize.query(`
      ALTER TABLE "bulk_pass_batches"
      ALTER COLUMN "status" DROP DEFAULT;

      ALTER TABLE "bulk_pass_batches"
      ALTER COLUMN "status"
      TYPE "enum_bulk_pass_batches_status"
      USING "status"::text::"enum_bulk_pass_batches_status";

      ALTER TABLE "bulk_pass_batches"
      ALTER COLUMN "status"
      SET DEFAULT 'DRAFT';
    `);

    // Convert bulk_pass_status_logs.status to the new type too
    await queryInterface.sequelize.query(`
      ALTER TABLE "bulk_pass_status_logs"
      ALTER COLUMN "status" DROP DEFAULT;

      ALTER TABLE "bulk_pass_status_logs"
      ALTER COLUMN "status"
      TYPE "enum_bulk_pass_batches_status"
      USING "status"::text::"enum_bulk_pass_batches_status";
    `);

    // Now safe to drop the old type — nothing depends on it anymore
    await queryInterface.sequelize.query(`
      DROP TYPE "enum_bulk_pass_batches_status_old";
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_bulk_pass_batches_status"
      RENAME TO "enum_bulk_pass_batches_status_old";

      CREATE TYPE "enum_bulk_pass_batches_status" AS ENUM (
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'RETURNED_TO_APPLICANT',
        'REJECTED',
        'COMPLETED'
      );
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "bulk_pass_batches"
      ALTER COLUMN "status" DROP DEFAULT;

      ALTER TABLE "bulk_pass_batches"
      ALTER COLUMN "status"
      TYPE "enum_bulk_pass_batches_status"
      USING "status"::text::"enum_bulk_pass_batches_status";

      ALTER TABLE "bulk_pass_batches"
      ALTER COLUMN "status"
      SET DEFAULT 'DRAFT';
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "bulk_pass_status_logs"
      ALTER COLUMN "status" DROP DEFAULT;

      ALTER TABLE "bulk_pass_status_logs"
      ALTER COLUMN "status"
      TYPE "enum_bulk_pass_batches_status"
      USING "status"::text::"enum_bulk_pass_batches_status";
    `);

    await queryInterface.sequelize.query(`
      DROP TYPE "enum_bulk_pass_batches_status_old";
    `);
  },
};