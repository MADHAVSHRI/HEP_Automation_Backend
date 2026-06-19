'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert(
      'locations',
      [
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
      ],
      {}
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('locations', null, {});
  },
};