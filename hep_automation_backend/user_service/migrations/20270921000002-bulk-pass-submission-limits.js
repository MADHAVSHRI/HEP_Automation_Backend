"use strict";

/**
 * Bulk Pass: cumulative submission limits + expiry-reminder bookkeeping.
 *
 * Until now a reusable Bulk Pass only had a *per batch* ceiling, so a single
 * link could accept an unbounded number of batches for its whole validity
 * window. These columns give the issuing department an overall budget:
 *
 *   maxSubmissions   — how many batches the link will accept in total
 *   maxTotalPersons  — how many people may come through it in total
 *
 * NULL means "no limit", which preserves the behaviour of every Bulk Pass
 * issued before this migration. New passes get a limit from the create form.
 *
 * expiryReminderSentAt stamps the one-time "your bulk pass is about to close"
 * notice so the daily job never mails the same pass twice.
 *
 * @type {import('sequelize-cli').Migration}
 */

const BATCH_COLUMNS = {
  maxSubmissions: { type: "INTEGER", allowNull: true },
  maxTotalPersons: { type: "INTEGER", allowNull: true },
  expiryReminderSentAt: { type: "DATE", allowNull: true },
};

const PARENT_REQUEST_COLUMNS = {
  max_submissions: { type: "INTEGER", allowNull: true },
  max_total_persons: { type: "INTEGER", allowNull: true },
  expiry_reminder_sent_at: { type: "DATE", allowNull: true },
};

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function addMissingColumns(queryInterface, Sequelize, tableName, columns) {
  if (!(await tableExists(queryInterface, tableName))) return;
  const description = await queryInterface.describeTable(tableName);

  for (const [name, spec] of Object.entries(columns)) {
    if (description[name]) continue;
    await queryInterface.addColumn(tableName, name, {
      type: Sequelize[spec.type],
      allowNull: spec.allowNull,
    });
  }
}

async function dropColumns(queryInterface, tableName, columns) {
  if (!(await tableExists(queryInterface, tableName))) return;
  const description = await queryInterface.describeTable(tableName);
  for (const name of Object.keys(columns)) {
    if (description[name]) await queryInterface.removeColumn(tableName, name);
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await addMissingColumns(queryInterface, Sequelize, "bulk_pass_batches", BATCH_COLUMNS);
    await addMissingColumns(
      queryInterface,
      Sequelize,
      "bulk_pass_parent_requests",
      PARENT_REQUEST_COLUMNS
    );
  },

  async down(queryInterface) {
    await dropColumns(queryInterface, "bulk_pass_parent_requests", PARENT_REQUEST_COLUMNS);
    await dropColumns(queryInterface, "bulk_pass_batches", BATCH_COLUMNS);
  },
};
