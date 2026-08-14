"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.bulkInsert("customs_operators", [
      {
        loginId: "CUSTOMS001",
        password:
          "$2b$10$IgzFt7OYCSDuhPCPO4po1.Cs9dp1Ez2RvPjGdUaFpieoM.IOTRklC",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "customs_operators",
      {
        loginId: "CUSTOMS001",
      },
      {}
    );
  },
};