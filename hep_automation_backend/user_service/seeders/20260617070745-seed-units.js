'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const allUnits = [
      {
        unitName: 'Gram',
        unitCode: 'g',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        unitName: 'Kilogram',
        unitCode: 'kg',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        unitName: 'Milligram',
        unitCode: 'mg',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        unitName: 'Ton',
        unitCode: 't',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        unitName: 'Millilitre',
        unitCode: 'mL',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        unitName: 'Litre',
        unitCode: 'L',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        unitName: 'Piece',
        unitCode: 'pcs',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        unitName: 'Box',
        unitCode: 'box',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        unitName: 'Meter',
        unitCode: 'm',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        unitName: 'Centimeter',
        unitCode: 'cm',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        unitName: 'Others',
        unitCode: 'Others',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT "unitName" FROM units WHERE "unitName" IN (:names)`,
      {
        replacements: { names: allUnits.map((u) => u.unitName) },
      }
    );

    const existingNames = new Set((existingRows || []).map((r) => r.unitName));
    const newRecords = allUnits.filter((u) => !existingNames.has(u.unitName));

    if (newRecords.length > 0) {
      await queryInterface.bulkInsert('units', newRecords, {});
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('units', null, {});
  },
};