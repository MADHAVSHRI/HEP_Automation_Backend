"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add twoWheelerChangeCount column to pass_persons if not exists
    const passPersonsDesc = await queryInterface.describeTable("pass_persons").catch(() => null);
    if (passPersonsDesc && !passPersonsDesc.twoWheelerChangeCount) {
      await queryInterface.addColumn("pass_persons", "twoWheelerChangeCount", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    // 2. Add twoWheelerChangeCount column to vendor_pass_persons if table exists & column missing
    const vendorPersonsDesc = await queryInterface.describeTable("vendor_pass_persons").catch(() => null);
    if (vendorPersonsDesc && !vendorPersonsDesc.twoWheelerChangeCount) {
      await queryInterface.addColumn("vendor_pass_persons", "twoWheelerChangeCount", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    // 3. Create two_wheeler_change_requests table if not exists
    const hasTable = await queryInterface.showAllTables().then(tables => tables.includes("two_wheeler_change_requests"));
    if (!hasTable) {
      await queryInterface.createTable("two_wheeler_change_requests", {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER,
        },
        passRequestId: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        personId: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        isVendorPass: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        personName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        personPassNo: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        companyName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        oldVehicleNo: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        newVehicleNo: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        reason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "PENDING",
        },
        rejectedReason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        changeCount: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn("NOW"),
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn("NOW"),
        },
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("two_wheeler_change_requests").catch(() => null);
  },
};
