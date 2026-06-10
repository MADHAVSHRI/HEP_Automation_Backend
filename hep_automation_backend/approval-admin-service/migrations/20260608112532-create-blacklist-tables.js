'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('blacklist_entries', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      entity_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      identifier: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      entity_name: {
        type: Sequelize.STRING(255),
      },

      reason: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      scenario: {
        type: Sequelize.STRING(50),
      },

      has_penalty: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      penalty_amount: {
        type: Sequelize.DECIMAL(12, 2),
      },

      penalty_status: {
        type: Sequelize.STRING(20),
        defaultValue: 'NOT_APPLICABLE',
      },

      status: {
        type: Sequelize.STRING(30),
        defaultValue: 'BLACKLISTED',
      },

      blacklisted_by: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      blacklisted_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },

      unblacklisted_by: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      unblacklisted_at: {
        type: Sequelize.DATE,
      },

      compliance_notes: {
        type: Sequelize.TEXT,
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

    await queryInterface.createTable('blacklist_audit_log', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      blacklist_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'blacklist_entries',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      action: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },

      performed_by: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      remarks: {
        type: Sequelize.TEXT,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex(
      'blacklist_entries',
      ['identifier'],
      { name: 'idx_blacklist_identifier' }
    );

    await queryInterface.addIndex(
      'blacklist_entries',
      ['status'],
      { name: 'idx_blacklist_status' }
    );

    await queryInterface.addIndex(
      'blacklist_entries',
      ['entity_type'],
      { name: 'idx_blacklist_entity_type' }
    );

    await queryInterface.addIndex(
      'blacklist_audit_log',
      ['blacklist_id'],
      { name: 'idx_blacklist_audit_blid' }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'blacklist_audit_log',
      'idx_blacklist_audit_blid'
    );

    await queryInterface.removeIndex(
      'blacklist_entries',
      'idx_blacklist_entity_type'
    );

    await queryInterface.removeIndex(
      'blacklist_entries',
      'idx_blacklist_status'
    );

    await queryInterface.removeIndex(
      'blacklist_entries',
      'idx_blacklist_identifier'
    );

    await queryInterface.dropTable('blacklist_audit_log');
    await queryInterface.dropTable('blacklist_entries');
  },
};