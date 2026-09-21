"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create dedicated essential_pass_conversions table
    await queryInterface.createTable("essential_pass_conversions", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      passRequestId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "pass_requests",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      entityType: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      entityId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      departmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      purpose: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      requisitionLetterPath: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      conversionStartDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      conversionEndDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      workflowState: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "PENDING",
      },
      rejectedReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      revertReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    // 2. Add Indexes
    try {
      await queryInterface.addIndex("essential_pass_conversions", ["passRequestId"], { name: "idx_epc_pass_req_id" });
      await queryInterface.addIndex("essential_pass_conversions", ["entityType", "entityId"], { name: "idx_epc_entity" });
      await queryInterface.addIndex("essential_pass_conversions", ["workflowState"], { name: "idx_epc_workflow" });
      await queryInterface.addIndex("essential_pass_conversions", ["status"], { name: "idx_epc_status" });
    } catch (e) {
      // Ignore index duplication warning if index exists
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("essential_pass_conversions");
  },
};
