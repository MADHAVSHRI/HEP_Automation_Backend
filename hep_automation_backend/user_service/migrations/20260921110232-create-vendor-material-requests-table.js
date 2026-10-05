"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "vendor_material_requests",
      {
        id: {
          type: Sequelize.BIGINT,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },

        referenceNumber: {
          type: Sequelize.STRING(40),
          allowNull: false,
          unique: true,
        },

        vendorMaterialLinkId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: {
            model: "vendor_material_links",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },

        requestSource: {
          type: Sequelize.STRING(20),
          allowNull: false,
        },

        requestType: {
          type: Sequelize.STRING(20),
          allowNull: false,
        },

        vehicleNumber: {
          type: Sequelize.STRING(30),
          allowNull: true,
        },

        personName: {
          type: Sequelize.STRING(150),
          allowNull: true,
        },

        aadhaarNumber: {
          type: Sequelize.STRING(12),
          allowNull: true,
        },

        requiresFireSafety: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        requiresTrafficApproval: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        currentStage: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: "DRAFT",
        },

        status: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "DRAFT",
        },

        isEnabled: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },

        currentRevisionNumber: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },

        createdByUserId: {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },

        submittedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },

        approvedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },

        rejectedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },

        completedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },

        vendorRemarks: {
          type: Sequelize.STRING(1000),
          allowNull: true,
        },

        reSubmissionCount: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },

        inventoryAppliedAt: {
          type: Sequelize.DATE,
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
      ALTER TABLE "vendor_material_requests"
      ADD CONSTRAINT "chk_vendor_material_requests_source"
      CHECK ("requestSource" IN ('VENDOR', 'DEPARTMENT'));

      ALTER TABLE "vendor_material_requests"
      ADD CONSTRAINT "chk_vendor_material_requests_type"
      CHECK ("requestType" IN ('REGULAR', 'SURPLUS'));

      ALTER TABLE "vendor_material_requests"
      ADD CONSTRAINT "chk_vendor_material_requests_stage"
      CHECK (
        "currentStage" IN (
          'DRAFT',
          'PENDING_DEPARTMENT',
          'PENDING_FIRE_SAFETY_OFFICER',
          'PENDING_TRAFFIC_DEPARTMENT',
          'PENDING_CISF_ASSISTANT_COMMANDANT',
          'REVERTED_TO_VENDOR',
          'REVERTED_TO_DEPARTMENT',
          'REVERTED_TO_FIRE_SAFETY_OFFICER',
          'COMPLETED',
          'REJECTED',
          'CANCELLED'
        )
      );

      ALTER TABLE "vendor_material_requests"
      ADD CONSTRAINT "chk_vendor_material_requests_status"
      CHECK (
        "status" IN (
          'DRAFT',
          'SUBMITTED',
          'REVERTED',
          'APPROVED',
          'REJECTED',
          'CANCELLED'
        )
      );

      ALTER TABLE "vendor_material_requests"
      ADD CONSTRAINT "chk_vendor_material_requests_aadhaar"
      CHECK (
        "aadhaarNumber" IS NULL
        OR "aadhaarNumber" ~ '^[0-9]{12}$'
      );

      ALTER TABLE "vendor_material_requests"
      ADD CONSTRAINT "chk_vendor_material_requests_revision"
      CHECK (
        "currentRevisionNumber" >= 1
        AND "reSubmissionCount" >= 0
      );

      ALTER TABLE "vendor_material_requests"
      ADD CONSTRAINT "chk_vendor_material_requests_creator"
      CHECK (
        "requestSource" <> 'DEPARTMENT'
        OR "createdByUserId" IS NOT NULL
      );
    `);

    await queryInterface.addIndex(
      "vendor_material_requests",
      ["vendorMaterialLinkId", "createdAt"],
      {
        name: "idx_vendor_material_requests_link_created",
      }
    );

    await queryInterface.addIndex(
      "vendor_material_requests",
      ["currentStage", "submittedAt"],
      {
        name: "idx_vendor_material_requests_stage_submitted",
      }
    );

    await queryInterface.addIndex(
      "vendor_material_requests",
      ["status", "updatedAt"],
      {
        name: "idx_vendor_material_requests_status_updated",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(
      "vendor_material_requests"
    );
  },
};