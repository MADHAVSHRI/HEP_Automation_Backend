"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Gender is not collected for bulk passes — drop the unused column.
    await queryInterface.removeColumn("bulk_pass_persons", "gender");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("bulk_pass_persons", "gender", {
      type: Sequelize.STRING(10),
      allowNull: true,
    });
  },
};
