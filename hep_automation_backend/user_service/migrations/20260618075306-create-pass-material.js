'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('pass_material', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				allowNull: false,
			},

			materialPassRequestId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'material_pass_request',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'CASCADE',
			},

			materialPassTypeId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'material_pass_type',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'RESTRICT',
			},

			movement: {
				type: Sequelize.ENUM('IN', 'OUT'),
				allowNull: false,
			},

			rateId: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: 'material_pass_rates',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'SET NULL',
			},

			isActive: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},

			isBlocked: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},

			status: {
				type: Sequelize.ENUM(
					'Pending',
					'Approved',
					'Rejected',
					'Reverted',
					'Expired'
				),
				allowNull: false,
				defaultValue: 'Pending',
			},

			rejectedReason: {
				type: Sequelize.TEXT,
				allowNull: true,
			},

			materialPassNo: {
				type: Sequelize.STRING(100),
				allowNull: false,
				unique: true,
			},

			qrUuid: {
				type: Sequelize.UUID,
				allowNull: true,
				unique: true,
			},

			scannedAt: {
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
    await queryInterface.addConstraint('pass_material', {
      fields: ['materialPassRequestId', 'materialPassTypeId'],
      type: 'unique',
      name: 'unique_material_pass_per_request',
    });
	},

	async down(queryInterface) {
		await queryInterface.dropTable('pass_material');

		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_pass_material_movement";'
		);

		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_pass_material_status";'
		);
	},
};