"use strict";

/**
 * Bulk Pass: "No. of Persons/Vehicles" become "Max No. of Persons/Vehicles".
 *
 * On a Bulk Pass these numbers are a ceiling, not a headcount — and on a
 * reusable pass the ceiling applies to each batch submitted against the link,
 * not to the pass as a whole. Renaming the columns keeps the database saying
 * the same thing as the UI, and the default of 30 is the Bulk Pass default.
 *
 * Idempotent: every step checks the current shape first, so this is a no-op on
 * databases where the rename has already been applied out of band.
 *
 * @type {import('sequelize-cli').Migration}
 */

const BATCH_COLUMNS = [
  { from: "noOfPersons", to: "maxNoOfPersons" },
  { from: "noOfVehicles", to: "maxNoOfVehicles" },
];

const PARENT_REQUEST_COLUMNS = [
  { from: "no_of_persons", to: "max_no_of_persons" },
  { from: "no_of_vehicles", to: "max_no_of_vehicles" },
];

const DEFAULT_MAX = 30;

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function renameAndDefault(queryInterface, Sequelize, tableName, columns, { notNull }) {
  if (!(await tableExists(queryInterface, tableName))) return;

  for (const { from, to } of columns) {
    let description = await queryInterface.describeTable(tableName);

    // Rename only when the old name is still there and the new one is not.
    if (description[from] && !description[to]) {
      await queryInterface.renameColumn(tableName, from, to);
      description = await queryInterface.describeTable(tableName);
    }

    if (!description[to]) continue;

    // Backfill before tightening the column, so existing rows stay valid.
    await queryInterface.sequelize.query(
      `UPDATE "${tableName}" SET "${to}" = ${DEFAULT_MAX} WHERE "${to}" IS NULL`
    );

    await queryInterface.changeColumn(tableName, to, {
      type: Sequelize.INTEGER,
      allowNull: !notNull,
      defaultValue: DEFAULT_MAX,
    });
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await renameAndDefault(queryInterface, Sequelize, "bulk_pass_batches", BATCH_COLUMNS, {
      notNull: false,
    });
    await renameAndDefault(
      queryInterface,
      Sequelize,
      "bulk_pass_parent_requests",
      PARENT_REQUEST_COLUMNS,
      { notNull: true }
    );
  },

  async down(queryInterface, Sequelize) {
    const revert = async (tableName, columns, notNull) => {
      if (!(await tableExists(queryInterface, tableName))) return;
      for (const { from, to } of columns) {
        const description = await queryInterface.describeTable(tableName);
        if (description[to] && !description[from]) {
          await queryInterface.renameColumn(tableName, to, from);
          await queryInterface.changeColumn(tableName, from, {
            type: Sequelize.INTEGER,
            allowNull: !notNull,
            defaultValue: 0,
          });
        }
      }
    };

    await revert("bulk_pass_parent_requests", PARENT_REQUEST_COLUMNS, true);
    await revert("bulk_pass_batches", BATCH_COLUMNS, false);
  },
};
