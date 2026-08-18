"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const allTypes = [
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
      {
        name: "Vendors",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT name FROM hep_types WHERE name IN (:names)`,
      {
        replacements: { names: allTypes.map((t) => t.name) },
      }
    );

    const existingNames = new Set((existingRows || []).map((r) => r.name));
    const newRecords = allTypes.filter((t) => !existingNames.has(t.name));

    if (newRecords.length > 0) {
      await queryInterface.bulkInsert("hep_types", newRecords);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("hep_types", null, {});
  },
};
