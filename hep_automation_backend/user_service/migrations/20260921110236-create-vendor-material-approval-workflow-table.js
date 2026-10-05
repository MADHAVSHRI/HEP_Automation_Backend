"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "vendor_material_approval_workflow",
      {
        id: {
          type: Sequelize.BIGINT,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },

        requestId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: {
            model: "vendor_material_requests",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },

        requestRevisionNumber: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },

        approvalStage: {
          type: Sequelize.STRING(50),
          allowNull: false,
        },

        approverUserId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },

        approverUserName: {
          type: Sequelize.STRING(150),
          allowNull: false,
        },

        decision: {
          type: Sequelize.STRING(50),
          allowNull: false,
        },

        remarks: {
          type: Sequelize.STRING(1000),
          allowNull: true,
        },

        gatesChanged: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        alteredGateIds: {
          type: Sequelize.ARRAY(Sequelize.BIGINT),
          allowNull: true,
        },

        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },

        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      }
    );

    await queryInterface.sequelize.query(`
      ALTER TABLE "vendor_material_approval_workflow"
      ADD CONSTRAINT "chk_vendor_material_approval_stage"
      CHECK (
        "approvalStage" IN (
          'DEPARTMENT',
          'FIRE_SAFETY_OFFICER',
          'TRAFFIC_DEPARTMENT',
          'CISF_ASSISTANT_COMMANDANT'
        )
      );

      ALTER TABLE "vendor_material_approval_workflow"
      ADD CONSTRAINT "chk_vendor_material_approval_decision"
      CHECK (
        "decision" IN (
          'APPROVED',
          'REJECTED',
          'REVERTED_TO_VENDOR',
          'REVERTED_TO_DEPARTMENT',
          'REVERTED_TO_FIRE_SAFETY_OFFICER'
        )
      );

      ALTER TABLE "vendor_material_approval_workflow"
      ADD CONSTRAINT "chk_vendor_material_approval_revision"
      CHECK ("requestRevisionNumber" >= 1);

      ALTER TABLE "vendor_material_approval_workflow"
      ADD CONSTRAINT "chk_vendor_material_approval_remarks"
      CHECK (
        "decision" = 'APPROVED'
        OR (
          "remarks" IS NOT NULL
          AND LENGTH(TRIM("remarks")) > 0
        )
      );

      ALTER TABLE "vendor_material_approval_workflow"
      ADD CONSTRAINT "chk_vendor_material_approval_gates"
      CHECK (
        (
          "gatesChanged" = FALSE
          AND "alteredGateIds" IS NULL
        )
        OR
        (
          "gatesChanged" = TRUE
          AND "alteredGateIds" IS NOT NULL
          AND CARDINALITY("alteredGateIds") > 0
        )
      );
    `);

    await queryInterface.addIndex(
      "vendor_material_approval_workflow",
      ["requestId", "requestRevisionNumber", "createdAt"],
      {
        name: "idx_vendor_material_approval_request_revision",
      }
    );

    await queryInterface.addIndex(
      "vendor_material_approval_workflow",
      ["approvalStage", "decision", "createdAt"],
      {
        name: "idx_vendor_material_approval_stage_decision",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(
      "vendor_material_approval_workflow"
    );
  },
};