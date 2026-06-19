'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('material_pass_approvals', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				allowNull: false,
			},

			passMaterialId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				unique: true,
				references: {
					model: 'pass_material',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'CASCADE',
			},

			departmentApprovalStatus: {
				type: Sequelize.ENUM(
					'Pending',
					'Approved',
					'Reverted',
					'Rejected'
				),
				allowNull: false,
				defaultValue: 'Pending',
			},

			departmentApprovedBy: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: 'users',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'SET NULL',
			},

			departmentApprovedAt: {
				type: Sequelize.DATE,
				allowNull: true,
			},

			departmentRemarks: {
				type: Sequelize.TEXT,
				allowNull: true,
			},

			revertCount: {
				type: Sequelize.INTEGER,
				allowNull: false,
				defaultValue: 0,
			},

			trafficApprovalStatus: {
				type: Sequelize.ENUM(
					'Pending',
					'Approved',
          'Reverted',
					'Rejected'
				),
				allowNull: false,
				defaultValue: 'Pending',
			},

			trafficApprovedBy: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: 'users',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'SET NULL',
			},

			trafficApprovedAt: {
				type: Sequelize.DATE,
				allowNull: true,
			},

			trafficRemarks: {
				type: Sequelize.TEXT,
				allowNull: true,
			},

			cisfApprovalStatus: {
				type: Sequelize.ENUM(
					'Pending',
					'Approved',
          'Reverted',
					'Rejected'
				),
				allowNull: false,
				defaultValue: 'Pending',
			},

			cisfApprovedBy: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: 'users',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'SET NULL',
			},

			cisfApprovedAt: {
				type: Sequelize.DATE,
				allowNull: true,
			},

			cisfRemarks: {
				type: Sequelize.TEXT,
				allowNull: true,
			},

			isActive: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: true,
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
	},

	async down(queryInterface) {
		await queryInterface.dropTable('material_pass_approvals');

		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_material_pass_approvals_departmentApprovalStatus";'
		);

		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_material_pass_approvals_trafficApprovalStatus";'
		);

		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_material_pass_approvals_cisfApprovalStatus";'
		);
	},
};