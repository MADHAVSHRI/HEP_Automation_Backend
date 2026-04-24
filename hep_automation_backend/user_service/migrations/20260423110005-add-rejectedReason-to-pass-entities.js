"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /*
    ============================================
    Add rejectedReason to pass_persons
    ============================================
    */

    await queryInterface.addColumn("pass_persons", "rejectedReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    /*
    ============================================
    Add rejectedReason to pass_vehicles
    ============================================
    */

    await queryInterface.addColumn("pass_vehicles", "rejectedReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("pass_persons", "rejectedReason");

    await queryInterface.removeColumn("pass_vehicles", "rejectedReason");
  },
};
