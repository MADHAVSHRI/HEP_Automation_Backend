"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // "Valid from" date-time for the batch. Combined with the existing
    // "validityUpto" column this forms a full validity window (from → upto).
    // Nullable so existing batches (which only have validityUpto) are preserved.
    await queryInterface.addColumn("bulk_pass_batches", "validityFrom", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("bulk_pass_batches", "validityFrom");
  },
};
