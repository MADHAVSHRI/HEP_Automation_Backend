'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const allFees = [
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
    ];

    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT category FROM pass_fee_master WHERE category IN (:cats)`,
      {
        replacements: { cats: allFees.map((f) => f.category) },
      }
    );

    const existingCats = new Set((existingRows || []).map((r) => r.category));
    const newRecords = allFees.filter((f) => !existingCats.has(f.category));

    if (newRecords.length > 0) {
      await queryInterface.bulkInsert('pass_fee_master', newRecords, {});
    }
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