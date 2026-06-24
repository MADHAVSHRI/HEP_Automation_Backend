"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Marks a person as one of the two "in-charge" persons for the batch.
    await queryInterface.addColumn("bulk_pass_persons", "inCharge", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    // Path to the uploaded Aadhaar card document (mandatory for in-charge persons).
    await queryInterface.addColumn("bulk_pass_persons", "aadhaarCardPath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("bulk_pass_persons", "aadhaarCardPath");
    await queryInterface.removeColumn("bulk_pass_persons", "inCharge");
  },
};
