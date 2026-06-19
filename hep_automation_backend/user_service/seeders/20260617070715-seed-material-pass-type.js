'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert(
      'material_pass_type',
      [
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
      ],
      {}
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('material_pass_type', null, {});
  },
};