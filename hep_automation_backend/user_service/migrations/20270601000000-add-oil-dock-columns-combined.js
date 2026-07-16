"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add columns to pass_requests & vendor_pass_requests
    await queryInterface.addColumn("pass_requests", "isOilDock", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });
    await queryInterface.addColumn("pass_requests", "workflowState", {
      type: Sequelize.STRING(100),
      defaultValue: "PENDING_PASS_SECTION",
      allowNull: false,
    });

    await queryInterface.addColumn("vendor_pass_requests", "isOilDock", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });
    await queryInterface.addColumn("vendor_pass_requests", "workflowState", {
      type: Sequelize.STRING(100),
      defaultValue: "PENDING_PASS_SECTION",
      allowNull: false,
    });

    // 2. Add columns to pass_vehicles & vendor_pass_vehicles
    const vehicleTables = ["pass_vehicles", "vendor_pass_vehicles"];
    for (const table of vehicleTables) {
      await queryInterface.addColumn(table, "twistLockCertified", {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
      await queryInterface.addColumn(table, "twistLockRemarks", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      await queryInterface.addColumn(table, "sparkArresterCertified", {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
      await queryInterface.addColumn(table, "sparkArresterRemarks", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      await queryInterface.addColumn(table, "isReverted", {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
      await queryInterface.addColumn(table, "lastRevertReason", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    // 3. Add columns to pass_persons & vendor_pass_persons
    const personTables = ["pass_persons", "vendor_pass_persons"];
    for (const table of personTables) {
      await queryInterface.addColumn(table, "srDtmApproved", {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
      await queryInterface.addColumn(table, "srDtmRemarks", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      await queryInterface.addColumn(table, "isReverted", {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
      await queryInterface.addColumn(table, "lastRevertReason", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // 1. Remove columns from pass_requests & vendor_pass_requests
    await queryInterface.removeColumn("pass_requests", "isOilDock");
    await queryInterface.removeColumn("pass_requests", "workflowState");
    await queryInterface.removeColumn("vendor_pass_requests", "isOilDock");
    await queryInterface.removeColumn("vendor_pass_requests", "workflowState");

    // 2. Remove columns from pass_vehicles & vendor_pass_vehicles
    const vehicleTables = ["pass_vehicles", "vendor_pass_vehicles"];
    for (const table of vehicleTables) {
      await queryInterface.removeColumn(table, "twistLockCertified");
      await queryInterface.removeColumn(table, "twistLockRemarks");
      await queryInterface.removeColumn(table, "sparkArresterCertified");
      await queryInterface.removeColumn(table, "sparkArresterRemarks");
      await queryInterface.removeColumn(table, "isReverted");
      await queryInterface.removeColumn(table, "lastRevertReason");
    }

    // 3. Remove columns from pass_persons & vendor_pass_persons
    const personTables = ["pass_persons", "vendor_pass_persons"];
    for (const table of personTables) {
      await queryInterface.removeColumn(table, "srDtmApproved");
      await queryInterface.removeColumn(table, "srDtmRemarks");
      await queryInterface.removeColumn(table, "isReverted");
      await queryInterface.removeColumn(table, "lastRevertReason");
    }
  },
};
