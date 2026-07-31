'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('pass_fee_master', [
      {
        category: 'INDIVIDUAL',
        daily_fee: 13.00,
        monthly_fee: 191.00,
        yearly_fee: 508.00,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        category: 'VEHICLE',
        daily_fee: 32.00,
        monthly_fee: 382.00,
        yearly_fee: 2539.00,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        category: 'CARGO_HANDLING_EQUIPMENT',
        daily_fee: 51.00,
        monthly_fee: 571.00,
        yearly_fee: 3807.00,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('pass_fee_master', {
      category: [
        'INDIVIDUAL',
        'VEHICLE',
        'CARGO_HANDLING_EQUIPMENT'
      ]
    }, {});
  }
};