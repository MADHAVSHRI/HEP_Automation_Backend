"use strict";

/** @type {import('sequelize-cli').Migration} */

"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert("hep_rates", [
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
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("hep_rates", null, {});
  },
};
