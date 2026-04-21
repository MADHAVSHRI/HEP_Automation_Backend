"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("pass_requests", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      agentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Agents",
          key: "id",
        },
      },

      referenceNo: {
        type: Sequelize.STRING(30),
        unique: true,
      },

      purposeOfVisitId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "visit_purposes",
          key: "id",
        },
      },

      authLetterFilePath: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      authLetterFileName: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },

      baseTotal: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      grossTotal: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      gstAmount: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      netAmount: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },

      paymentMode: {
        type: Sequelize.ENUM("ACCOUNT", "ECASH"),
        defaultValue: "ACCOUNT",
      },

      status: {
        type: Sequelize.ENUM(
          "DRAFT",
          "SUBMITTED",
          "UNDER_REVIEW",
          "APPROVED",
          "REJECTED",
        ),
        defaultValue: "DRAFT",
      },

      submittedAt: { type: Sequelize.DATE },

      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      isBlocked: { type: Sequelize.BOOLEAN, defaultValue: false },

      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex("pass_requests", ["agentId"], {
      name: "idx_pass_requests_agent",
    });

    await queryInterface.addIndex("pass_requests", ["status"], {
      name: "idx_pass_requests_status",
    });

    await queryInterface.addIndex("pass_requests", ["submittedAt"], {
      name: "idx_pass_requests_submitted",
    });

    await queryInterface.addIndex("pass_requests", ["agentId", "createdAt"], {
      name: "idx_pass_requests_agent_created",
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
