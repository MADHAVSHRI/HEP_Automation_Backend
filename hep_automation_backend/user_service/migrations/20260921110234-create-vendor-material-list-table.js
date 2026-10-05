"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "vendor_material_list",
      {
        id: {
          type: Sequelize.BIGINT,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },

        vendorMaterialRequestId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: {
            model: "vendor_material_requests",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },

        vendorMasterItemId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: {
            model: "vendor_master_items",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },

        quantityMode: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "LIMITED",
        },

        requestedQty: {
          type: Sequelize.DECIMAL(18, 3),
          allowNull: true,
        },

        departmentApprovedQty: {
          type: Sequelize.DECIMAL(18, 3),
          allowNull: true,
        },

        unitId: {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: {
            model: "units",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },

        description: {
          type: Sequelize.STRING(1000),
          allowNull: true,
        },

        isHazardous: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        departmentDecision: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "PENDING",
        },

        departmentRemarks: {
          type: Sequelize.STRING(1000),
          allowNull: true,
        },

        revisionNumber: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },

        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },

        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal(
            "CURRENT_TIMESTAMP"
          ),
        },

        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal(
            "CURRENT_TIMESTAMP"
          ),
        },
      }
    );

    await queryInterface.sequelize.query(`
      ALTER TABLE "vendor_material_list"
      ADD CONSTRAINT "chk_vendor_material_list_quantity_mode"
      CHECK (
        "quantityMode" IN (
          'LIMITED',
          'UNSPECIFIED'
        )
      );

      ALTER TABLE "vendor_material_list"
      ADD CONSTRAINT "chk_vendor_material_list_decision"
      CHECK (
        "departmentDecision" IN (
          'PENDING',
          'APPROVED',
          'REJECTED'
        )
      );

      ALTER TABLE "vendor_material_list"
      ADD CONSTRAINT "chk_vendor_material_list_revision"
      CHECK ("revisionNumber" >= 1);

      ALTER TABLE "vendor_material_list"
      ADD CONSTRAINT "chk_vendor_material_list_requested_qty"
      CHECK (
        "requestedQty" IS NULL
        OR "requestedQty" > 0
      );

      ALTER TABLE "vendor_material_list"
      ADD CONSTRAINT "chk_vendor_material_list_approved_qty"
      CHECK (
        "departmentApprovedQty" IS NULL
        OR "departmentApprovedQty" > 0
      );

      ALTER TABLE "vendor_material_list"
      ADD CONSTRAINT "chk_vendor_material_list_quantity_fields"
      CHECK (
        (
          "quantityMode" = 'LIMITED'
          AND "requestedQty" IS NOT NULL
          AND "unitId" IS NOT NULL
        )
        OR
        (
          "quantityMode" = 'UNSPECIFIED'
          AND "requestedQty" IS NULL
          AND "departmentApprovedQty" IS NULL
          AND "unitId" IS NULL
        )
      );

      ALTER TABLE "vendor_material_list"
      ADD CONSTRAINT "chk_vendor_material_list_decision_fields"
      CHECK (
        (
          "departmentDecision" = 'PENDING'
          AND "departmentApprovedQty" IS NULL
        )
        OR
        (
          "departmentDecision" = 'APPROVED'
          AND (
            (
              "quantityMode" = 'LIMITED'
              AND "departmentApprovedQty" IS NOT NULL
            )
            OR
            (
              "quantityMode" = 'UNSPECIFIED'
              AND "departmentApprovedQty" IS NULL
            )
          )
        )
        OR
        (
          "departmentDecision" = 'REJECTED'
          AND "departmentApprovedQty" IS NULL
          AND "departmentRemarks" IS NOT NULL
          AND LENGTH(
            TRIM("departmentRemarks")
          ) > 0
        )
      );
    `);

    await queryInterface.addIndex(
      "vendor_material_list",
      [
        "vendorMaterialRequestId",
        "revisionNumber",
        "isActive",
      ],
      {
        name:
          "idx_vendor_material_list_request_revision_active",
      }
    );

    await queryInterface.addIndex(
      "vendor_material_list",
      ["vendorMasterItemId"],
      {
        name:
          "idx_vendor_material_list_master_item",
      }
    );

    await queryInterface.addIndex(
      "vendor_material_list",
      [
        "vendorMaterialRequestId",
        "departmentDecision",
      ],
      {
        name:
          "idx_vendor_material_list_active_decision",
        where: {
          isActive: true,
        },
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(
      "vendor_material_list"
    );
  },
};