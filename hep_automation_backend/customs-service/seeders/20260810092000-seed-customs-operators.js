"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const allOperators = [
      {
        loginId: "CUSTOMS001",
        password:
          "$2b$10$IgzFt7OYCSDuhPCPO4po1.Cs9dp1Ez2RvPjGdUaFpieoM.IOTRklC",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT "loginId" FROM customs_operators WHERE "loginId" IN (:ids)`,
      {
        replacements: { ids: allOperators.map((o) => o.loginId) },
      }
    );

    const existingIds = new Set((existingRows || []).map((r) => r.loginId));
    const newRecords = allOperators.filter((o) => !existingIds.has(o.loginId));

    if (newRecords.length > 0) {
      await queryInterface.bulkInsert("customs_operators", newRecords);
    }
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