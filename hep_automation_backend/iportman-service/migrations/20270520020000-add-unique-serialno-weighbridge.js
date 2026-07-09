"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint("weighbridge_records", {
      fields: ["serialNo"],
      type: "unique",
      name: "weighbridge_records_serialNo_unique",
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(
      "weighbridge_records",
      "weighbridge_records_serialNo_unique",
    );
  },
};
