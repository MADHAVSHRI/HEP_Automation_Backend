"use strict";

/**
 * Bulk Pass: one submission number per batch inside a Bulk Pass.
 *
 * Submission numbers were assigned as MAX(existing) + 1 with nothing stopping
 * two simultaneous submissions from both reading the same maximum. The
 * controller now serialises submissions per Bulk Pass; this index is the
 * database's own guarantee should anything bypass that.
 *
 * Existing duplicates (if any) are renumbered in creation order first so the
 * index can be created on a live database.
 *
 * @type {import('sequelize-cli').Migration}
 */

const TABLE = "bulk_pass_batches";
const INDEX = "uniq_bulk_pass_child_submission_number";

module.exports = {
  async up(queryInterface) {
    // Renumber duplicates: keep the earliest row's number, push the others up
    // past the current maximum for that Bulk Pass.
    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT id,
               parent_request_id,
               request_source,
               ROW_NUMBER() OVER (
                 PARTITION BY parent_request_id, request_source
                 ORDER BY "createdAt" ASC, id ASC
               ) AS rn
        FROM "${TABLE}"
        WHERE parent_request_id IS NOT NULL
      ),
      dupes AS (
        SELECT b.id, r.rn
        FROM "${TABLE}" b
        JOIN ranked r ON r.id = b.id
        WHERE EXISTS (
          SELECT 1 FROM "${TABLE}" o
          WHERE o.parent_request_id = b.parent_request_id
            AND o.request_source = b.request_source
            AND o.submission_number = b.submission_number
            AND o.id <> b.id
        )
      )
      UPDATE "${TABLE}" b
      SET submission_number = d.rn
      FROM dupes d
      WHERE b.id = d.id;
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX}"
      ON "${TABLE}" (parent_request_id, request_source, submission_number)
      WHERE parent_request_id IS NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${INDEX}";`);
  },
};
