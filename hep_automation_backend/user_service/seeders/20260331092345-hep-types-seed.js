"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.bulkInsert("hep_types", [
      {
        name: "Drivers",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },

      {
        name: "Personnel",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },

      {
        name: "Seafarers",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("hep_types", null, {});
  },
};
