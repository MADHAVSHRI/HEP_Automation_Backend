"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Stores all vehicle document paths for a vehicle row as JSON, e.g.
    // { "rc": "uploads/...", "insurance": "uploads/...", "fitness": "...", ... }
    // Null for person rows.
    await queryInterface.addColumn("bulk_pass_persons", "vehicleDocs", {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("bulk_pass_persons", "vehicleDocs");
  },
};
