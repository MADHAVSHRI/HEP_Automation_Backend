'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('blacklist_entries', 'reason_code', {
      type: Sequelize.STRING(10),
      allowNull: true,
    });

    await queryInterface.addColumn('blacklist_entries', 'authorizing_officer', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addColumn('blacklist_entries', 'supporting_document_path', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn('blacklist_entries', 'geotag_latitude', {
      type: Sequelize.DECIMAL(10, 8),
      allowNull: true,
    });

    await queryInterface.addColumn('blacklist_entries', 'geotag_longitude', {
      type: Sequelize.DECIMAL(11, 8),
      allowNull: true,
    });

    await queryInterface.addColumn('blacklist_entries', 'geotag_accuracy', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
    });

    await queryInterface.addColumn('blacklist_entries', 'permit_one_gate_out', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    await queryInterface.addColumn('blacklist_entries', 'gate_out_used', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    await queryInterface.addColumn('blacklist_entries', 'reinstatement_justification', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('blacklist_entries', 'payment_method', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });

    await queryInterface.addColumn('blacklist_entries', 'transaction_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addIndex(
      'blacklist_entries',
      ['reason_code'],
      {
        name: 'idx_blacklist_reason_code',
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'blacklist_entries',
      'idx_blacklist_reason_code'
    );

    await queryInterface.removeColumn('blacklist_entries', 'transaction_id');
    await queryInterface.removeColumn('blacklist_entries', 'payment_method');
    await queryInterface.removeColumn('blacklist_entries', 'reinstatement_justification');
    await queryInterface.removeColumn('blacklist_entries', 'gate_out_used');
    await queryInterface.removeColumn('blacklist_entries', 'permit_one_gate_out');
    await queryInterface.removeColumn('blacklist_entries', 'geotag_accuracy');
    await queryInterface.removeColumn('blacklist_entries', 'geotag_longitude');
    await queryInterface.removeColumn('blacklist_entries', 'geotag_latitude');
    await queryInterface.removeColumn('blacklist_entries', 'supporting_document_path');
    await queryInterface.removeColumn('blacklist_entries', 'authorizing_officer');
    await queryInterface.removeColumn('blacklist_entries', 'reason_code');
  },
};