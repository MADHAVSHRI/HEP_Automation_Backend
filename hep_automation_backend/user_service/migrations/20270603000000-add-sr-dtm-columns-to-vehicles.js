"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const vehicleTables = ["pass_vehicles", "vendor_pass_vehicles"];
    for (const table of vehicleTables) {
      const tableInfo = await queryInterface.describeTable(table);
      
      if (!tableInfo.srDtmApproved) {
        await queryInterface.addColumn(table, "srDtmApproved", {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        });
      }
      
      if (!tableInfo.srDtmRemarks) {
        await queryInterface.addColumn(table, "srDtmRemarks", {
          type: Sequelize.TEXT,
          allowNull: true,
        });
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const vehicleTables = ["pass_vehicles", "vendor_pass_vehicles"];
    for (const table of vehicleTables) {
      const tableInfo = await queryInterface.describeTable(table);
      
      if (tableInfo.srDtmApproved) {
        await queryInterface.removeColumn(table, "srDtmApproved");
      }
      
      if (tableInfo.srDtmRemarks) {
        await queryInterface.removeColumn(table, "srDtmRemarks");
      }
    }
  },
};
