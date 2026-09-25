"use strict";

/**
 * Reconcile bulk_pass_parent_requests with the shape it actually has in
 * deployed environments.
 *
 * Two migrations in this repo's history created this table, and the copy that
 * ran in deployed databases differs from the one checked in: it carries an
 * `updated_at` column and defaults `token_active` to true. A database rebuilt
 * from the repo alone therefore diverged from production, which is how the
 * Bulk Pass code came to be written against columns the repo never declared.
 *
 * This migration closes that gap. It is idempotent, so it is a no-op wherever
 * the table is already correct.
 *
 * @type {import('sequelize-cli').Migration}
 */

const TABLE = "bulk_pass_parent_requests";

async function describe(queryInterface) {
  try {
    return await queryInterface.describeTable(TABLE);
  } catch {
    return null;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const description = await describe(queryInterface);
    if (!description) return; // table not created yet — nothing to reconcile

    // `updated_at` exists in deployed databases but not in the checked-in
    // create-table migration.
    if (!description.updated_at) {
      await queryInterface.addColumn(TABLE, "updated_at", {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      });
      await queryInterface.sequelize.query(
        `UPDATE "${TABLE}" SET updated_at = created_at WHERE updated_at IS NULL`
      );
    }

    // A request only ever becomes usable once an administrator approves it and
    // sets token_active explicitly, so the column default is cosmetic — but it
    // should match production rather than contradict it.
    if (description.token_active) {
      await queryInterface.changeColumn(TABLE, "token_active", {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const description = await describe(queryInterface);
    if (!description) return;

    if (description.updated_at) {
      await queryInterface.removeColumn(TABLE, "updated_at");
    }
    if (description.token_active) {
      await queryInterface.changeColumn(TABLE, "token_active", {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      });
    }
  },
};
