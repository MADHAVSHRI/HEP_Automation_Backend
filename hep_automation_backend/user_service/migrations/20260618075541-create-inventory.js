'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('inventory', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				allowNull: false,
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

			masterItemId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'master_items',
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

			currentQty: {
				type: Sequelize.INTEGER,
				allowNull: false,
				defaultValue: 0,
			},

			totalEnteredQty: {
				type: Sequelize.INTEGER,
				allowNull: false,
				defaultValue: 0,
			},

			totalExitedQty: {
				type: Sequelize.INTEGER,
				allowNull: false,
				defaultValue: 0,
			},

			isExitRequested: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},

			requestedExitQty: {
				type: Sequelize.INTEGER,
				allowNull: false,
				defaultValue: 0,
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
			ALTER TABLE "inventory"
			ADD CONSTRAINT inventory_user_type_check
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

    await queryInterface.sequelize.query(`
      ALTER TABLE "inventory"
      ADD CONSTRAINT inventory_quantity_check
      CHECK (
        "currentQty" >= 0
        AND "totalEnteredQty" >= 0
        AND "totalExitedQty" >= 0
        AND "requestedExitQty" >= 0
      );
    `);
	},

	async down(queryInterface) {
		await queryInterface.sequelize.query(`
			ALTER TABLE "inventory"
			DROP CONSTRAINT IF EXISTS inventory_user_type_check;
		`);

    await queryInterface.sequelize.query(`
      ALTER TABLE "inventory"
      DROP CONSTRAINT IF EXISTS inventory_quantity_check;
    `);

		await queryInterface.dropTable('inventory');

		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_inventory_userType";'
		);
	},
};