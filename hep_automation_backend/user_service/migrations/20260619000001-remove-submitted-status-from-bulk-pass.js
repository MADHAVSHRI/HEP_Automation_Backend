/**
 * Removes the SUBMITTED status from the bulk pass flow.
 */
exports.up = async function (db) {
  // Update any existing batches stuck in SUBMITTED to UNDER_REVIEW
  await db.runSql(`UPDATE "bulk_pass_batches" SET "status" = 'UNDER_REVIEW' WHERE "status" = 'SUBMITTED';`);
  await db.runSql(`UPDATE "bulk_pass_status_logs" SET "status" = 'UNDER_REVIEW' WHERE "status" = 'SUBMITTED';`);

  // PostgreSQL doesn't support dropping an ENUM value cleanly.
  // We rename the old type, create a new one without SUBMITTED, cast columns, and drop the old type.
  await db.runSql(`
    ALTER TYPE enum_bulk_pass_batches_status RENAME TO enum_bulk_pass_batches_status_old;
    CREATE TYPE enum_bulk_pass_batches_status AS ENUM ('DRAFT', 'UNDER_REVIEW', 'RETURNED_TO_APPLICANT', 'REJECTED', 'COMPLETED');
    ALTER TABLE "bulk_pass_batches" ALTER COLUMN "status" TYPE enum_bulk_pass_batches_status USING "status"::text::enum_bulk_pass_batches_status;
    ALTER TABLE "bulk_pass_status_logs" ALTER COLUMN "status" TYPE enum_bulk_pass_batches_status USING "status"::text::enum_bulk_pass_batches_status;
    DROP TYPE enum_bulk_pass_batches_status_old;
  `);
};

exports.down = async function (db) {
  // Re-add SUBMITTED status
  await db.runSql(`
    ALTER TYPE enum_bulk_pass_batches_status RENAME TO enum_bulk_pass_batches_status_old;
    CREATE TYPE enum_bulk_pass_batches_status AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED_TO_APPLICANT', 'REJECTED', 'COMPLETED');
    ALTER TABLE "bulk_pass_batches" ALTER COLUMN "status" TYPE enum_bulk_pass_batches_status USING "status"::text::enum_bulk_pass_batches_status;
    ALTER TABLE "bulk_pass_status_logs" ALTER COLUMN "status" TYPE enum_bulk_pass_batches_status USING "status"::text::enum_bulk_pass_batches_status;
    DROP TYPE enum_bulk_pass_batches_status_old;
  `);
};
