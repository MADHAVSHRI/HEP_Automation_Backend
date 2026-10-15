"use strict";

// Operator directory details (contacts, location, address). All nullable so
// existing operator rows stay valid. weighbridgeCode is generated from the id
// (WB001, WB002, ...) and backfilled for existing rows.
const COLUMNS = [
  "email1",
  "email2",
  "contactPerson1",
  "contactPersonDesignation1",
  "contactPersonPhone1",
  "contactPerson2",
  "contactPersonDesignation2",
  "contactPersonPhone2",
  "location",
  "telNo",
  "faxNo",
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("weighbridge_operators", "weighbridgeCode", {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });
    await queryInterface.sequelize.query(
      `UPDATE weighbridge_operators SET "weighbridgeCode" = 'WB' || LPAD(id::text, 3, '0')`,
    );
    for (const column of COLUMNS) {
      await queryInterface.addColumn("weighbridge_operators", column, {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    await queryInterface.addColumn("weighbridge_operators", "address", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("weighbridge_operators", "address");
    for (const column of COLUMNS) {
      await queryInterface.removeColumn("weighbridge_operators", column);
    }
    await queryInterface.removeColumn("weighbridge_operators", "weighbridgeCode");
  },
};
