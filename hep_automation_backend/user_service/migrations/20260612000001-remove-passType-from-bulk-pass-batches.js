"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("bulk_pass_batches", "passType");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("bulk_pass_batches", "passType", {
      type: Sequelize.ENUM("MULTIPLE", "SINGLE"),
      defaultValue: "MULTIPLE",
      allowNull: true,
    });
  },
};
