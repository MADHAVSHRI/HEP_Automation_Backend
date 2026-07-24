'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create AgentProfileUpdateRequests table
    await queryInterface.createTable('AgentProfileUpdateRequests', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      agentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Agents',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      referenceNumber: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      userTypeName: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      entityName: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      entityNameDoc: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      mobileNo: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      addressLine: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      pincode: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      addressDoc: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      licenseNumber: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      licenseValidityDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      licenseDoc: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      gstinNumber: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      gstinDoc: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      panNumber: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      panDoc: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      tanNumber: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      tanDoc: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
      },
      rejectedReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      processedBy: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      processedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 2. Add profileUpdateCounter column to daily_pass_counters
    await queryInterface.addColumn('daily_pass_counters', 'profileUpdateCounter', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('AgentProfileUpdateRequests');
    await queryInterface.removeColumn('daily_pass_counters', 'profileUpdateCounter');
  },
};
