'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pass_fee_master', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      category: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      daily_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      monthly_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      yearly_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addConstraint('pass_fee_master', {
      fields: ['category'],
      type: 'unique',
      name: 'uq_pass_fee_master_category'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint('pass_fee_master', 'uq_pass_fee_master_category');
    await queryInterface.dropTable('pass_fee_master');
  }
};
