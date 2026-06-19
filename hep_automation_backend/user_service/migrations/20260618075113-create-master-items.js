'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('master_items', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				allowNull: false,
			},

			name: {
				type: Sequelize.STRING(255),
				allowNull: false,
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

			unitId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'units',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'RESTRICT',
			},

			userType: {
				type: Sequelize.ENUM('Agent', 'Department'),
				allowNull: false,
			},

			agentId: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: 'Agents',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'SET NULL',
			},

			userId: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: 'users',
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
    await queryInterface.sequelize.query(`
		ALTER TABLE "master_items"
		ADD CONSTRAINT master_items_user_type_check
		CHECK (
			(
			"userType" = 'Agent'
			AND "agentId" IS NOT NULL
			AND "userId" IS NULL
			)
			OR
			(
			"userType" = 'Department'
			AND "userId" IS NOT NULL
			AND "agentId" IS NULL
			)
		);
	`);
	},

	async down(queryInterface) {
		await queryInterface.dropTable('master_items');

		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_master_items_userType";'
		);
	},
};