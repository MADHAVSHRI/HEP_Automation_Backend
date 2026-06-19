'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('material_pass_request', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				allowNull: false,
			},

			referenceNo: {
				type: Sequelize.STRING(100),
				allowNull: false,
				unique: true,
			},

			originType: {
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

			concernedDepartmentId: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: 'port_departments',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'SET NULL',
			},

			purposeOfVisitId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'visit_purposes',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'RESTRICT',
			},

			purposeOther: {
				type: Sequelize.TEXT,
				allowNull: true,
			},

			dateOfEntry: {
				type: Sequelize.DATE,
				allowNull: false,
			},

			expiryDate: {
				type: Sequelize.DATE,
				allowNull: false,
			},

			locationFrom: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'locations',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'RESTRICT',
			},

			locationTo: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'locations',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'RESTRICT',
			},

			locationOther: {
				type: Sequelize.STRING(255),
				allowNull: true,
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
          'Draft',
					'Submitted',
					'Completed',
					'Expired'
				),
				allowNull: false,
				defaultValue: 'Submitted',
			},

			submittedAt: {
				type: Sequelize.DATE,
				allowNull: true,
			},

			baseTotal: {
				type: Sequelize.DECIMAL(12, 2),
				allowNull: false,
				defaultValue: 0,
			},

			grossTotal: {
				type: Sequelize.DECIMAL(12, 2),
				allowNull: false,
				defaultValue: 0,
			},

			gstAmount: {
				type: Sequelize.DECIMAL(12, 2),
				allowNull: false,
				defaultValue: 0,
			},

			netAmount: {
				type: Sequelize.DECIMAL(12, 2),
				allowNull: false,
				defaultValue: 0,
			},

			paymentMode: {
				type: Sequelize.ENUM(
					'ECash',
					'Wallet',
					'Not Applicable'
				),
				allowNull: false,
				defaultValue: 'Not Applicable',
			},

			hasRevertedPass: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},

			revertCount: {
				type: Sequelize.INTEGER,
				allowNull: false,
				defaultValue: 0,
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
			ALTER TABLE "material_pass_request"
			ADD CONSTRAINT material_pass_request_origin_type_check
			CHECK (
				(
					"originType" = 'Agent'
					AND "agentId" IS NOT NULL
					AND "userId" IS NULL
					AND "concernedDepartmentId" IS NOT NULL
				)
				OR
				(
					"originType" = 'Department'
					AND "agentId" IS NULL
					AND "userId" IS NOT NULL
				)
			);
		`);
	},

	async down(queryInterface) {
		await queryInterface.sequelize.query(`
			ALTER TABLE "material_pass_request"
			DROP CONSTRAINT IF EXISTS material_pass_request_origin_type_check;
		`);

		await queryInterface.dropTable('material_pass_request');

		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_material_pass_request_originType";'
		);

		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_material_pass_request_status";'
		);

		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_material_pass_request_paymentMode";'
		);
	},
};