"use strict";

/** @type {import('sequelize-cli').Migration} */

"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const allRates = [
      {
        hepTypeId: 1,
        dailyRate: 50,
        monthlyRate: 1000,
        annualRate: 10000,
        auctionRate: 20000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      {
        hepTypeId: 2,
        dailyRate: 70,
        monthlyRate: 1500,
        annualRate: 15000,
        auctionRate: 25000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT "hepTypeId" FROM hep_rates WHERE "hepTypeId" IN (:ids)`,
      {
        replacements: { ids: allRates.map((r) => r.hepTypeId) },
      }
    );

    const existingIds = new Set((existingRows || []).map((r) => r.hepTypeId));
    const newRecords = allRates.filter((r) => !existingIds.has(r.hepTypeId));

    if (newRecords.length > 0) {
      await queryInterface.bulkInsert("hep_rates", newRecords);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("hep_rates", null, {});
  },
};
