'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('material_list', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				allowNull: false,
			},

			passMaterialId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'pass_material',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'CASCADE',
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

			requestedQty: {
				type: Sequelize.INTEGER,
				allowNull: false,
			},

			actualMovedQty: {
				type: Sequelize.INTEGER,
				allowNull: false,
				defaultValue: 0,
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
			ALTER TABLE "material_list"
			ADD CONSTRAINT material_list_qty_check
			CHECK (
				"requestedQty" >= 0
				AND "actualMovedQty" >= 0
				AND "actualMovedQty" <= "requestedQty"
			);
		`);
	},

	async down(queryInterface) {
		await queryInterface.sequelize.query(`
			ALTER TABLE "material_list"
			DROP CONSTRAINT IF EXISTS material_list_qty_check;
		`);

		await queryInterface.dropTable('material_list');
	},
};