"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const vehicleTables = ["pass_vehicles", "vendor_pass_vehicles"];
    for (const table of vehicleTables) {
      await queryInterface.addColumn(table, "sparkArresterFilePath", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
      await queryInterface.addColumn(table, "sparkArresterFileName", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
      await queryInterface.addColumn(table, "twistLockFilePath", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
      await queryInterface.addColumn(table, "twistLockFileName", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    const personTables = ["pass_persons", "vendor_pass_persons"];
    for (const table of personTables) {
      await queryInterface.addColumn(table, "entryAuthorizationFilePath", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
      await queryInterface.addColumn(table, "entryAuthorizationFileName", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const vehicleTables = ["pass_vehicles", "vendor_pass_vehicles"];
    for (const table of vehicleTables) {
      await queryInterface.removeColumn(table, "sparkArresterFilePath");
      await queryInterface.removeColumn(table, "sparkArresterFileName");
      await queryInterface.removeColumn(table, "twistLockFilePath");
      await queryInterface.removeColumn(table, "twistLockFileName");
    }

    const personTables = ["pass_persons", "vendor_pass_persons"];
    for (const table of personTables) {
      await queryInterface.removeColumn(table, "entryAuthorizationFilePath");
      await queryInterface.removeColumn(table, "entryAuthorizationFileName");
    }
  },
};
