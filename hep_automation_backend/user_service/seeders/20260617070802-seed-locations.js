'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const allLocations = [
      {
        name: 'Zone 1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Zone 2',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Zone 3',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Zone 4',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Zone 5',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Zone 6',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Zone 7',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Others',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT name FROM locations WHERE name IN (:names)`,
      {
        replacements: { names: allLocations.map((l) => l.name) },
      }
    );

    const existingNames = new Set((existingRows || []).map((r) => r.name));
    const newRecords = allLocations.filter((l) => !existingNames.has(l.name));

    if (newRecords.length > 0) {
      await queryInterface.bulkInsert('locations', newRecords, {});
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('locations', null, {});
  },
};