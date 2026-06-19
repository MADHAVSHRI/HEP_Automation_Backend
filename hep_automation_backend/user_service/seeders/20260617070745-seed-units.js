'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert(
      'units',
      [
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
      ],
      {}
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('units', null, {});
  },
};