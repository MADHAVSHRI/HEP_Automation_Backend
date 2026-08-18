'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const allTypes = [
      {
        name: 'Returnable',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Non Returnable',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Surplus',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Debris',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT name FROM material_pass_type WHERE name IN (:names)`,
      {
        replacements: { names: allTypes.map((t) => t.name) },
      }
    );

    const existingNames = new Set((existingRows || []).map((r) => r.name));
    const newRecords = allTypes.filter((t) => !existingNames.has(t.name));

    if (newRecords.length > 0) {
      await queryInterface.bulkInsert('material_pass_type', newRecords, {});
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('material_pass_type', null, {});
  },
};