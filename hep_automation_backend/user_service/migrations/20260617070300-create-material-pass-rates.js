'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('material_pass_rates', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
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

			rate: {
				type: Sequelize.DECIMAL(10, 2),
				allowNull: false,
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
		await queryInterface.dropTable('material_pass_rates');
	},
};