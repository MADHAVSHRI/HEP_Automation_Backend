"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Persist the request-letter / supporting document an officer attaches on
    // create. Previously the file was uploaded to disk but its path was never
    // stored, so the document was unretrievable. Nullable so existing batches
    // (and batches created without a document) are preserved.
    await queryInterface.addColumn("bulk_pass_batches", "workOrderFilePath", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("bulk_pass_batches", "workOrderFileName", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("bulk_pass_batches", "workOrderFileName");
    await queryInterface.removeColumn("bulk_pass_batches", "workOrderFilePath");
  },
};
