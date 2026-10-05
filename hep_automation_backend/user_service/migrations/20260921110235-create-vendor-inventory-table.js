"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "vendor_inventory",
      {
        id: {
          type: Sequelize.BIGINT,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
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

        totalApprovedQty: {
          type: Sequelize.DECIMAL(18, 3),
          allowNull: true,
        },

        enteredQty: {
          type: Sequelize.DECIMAL(18, 3),
          allowNull: false,
          defaultValue: 0,
        },

        exitedQty: {
          type: Sequelize.DECIMAL(18, 3),
          allowNull: false,
          defaultValue: 0,
        },

        currentInsideQty: {
          type: Sequelize.DECIMAL(18, 3),
          allowNull: false,
          defaultValue: 0,
        },

        remainingEntryQty: {
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

        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },

        lastMovementAt: {
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
      ALTER TABLE "vendor_inventory"
      ADD CONSTRAINT "chk_vendor_inventory_quantity_mode"
      CHECK ("quantityMode" IN ('LIMITED', 'UNSPECIFIED'));

      ALTER TABLE "vendor_inventory"
      ADD CONSTRAINT "chk_vendor_inventory_non_negative"
      CHECK (
        "enteredQty" >= 0
        AND "exitedQty" >= 0
        AND "currentInsideQty" >= 0
        AND (
          "totalApprovedQty" IS NULL
          OR "totalApprovedQty" >= 0
        )
        AND (
          "remainingEntryQty" IS NULL
          OR "remainingEntryQty" >= 0
        )
      );

      ALTER TABLE "vendor_inventory"
      ADD CONSTRAINT "chk_vendor_inventory_exit"
      CHECK ("exitedQty" <= "enteredQty");

      ALTER TABLE "vendor_inventory"
      ADD CONSTRAINT "chk_vendor_inventory_quantity_fields"
      CHECK (
        (
          "quantityMode" = 'LIMITED'
          AND "totalApprovedQty" IS NOT NULL
          AND "remainingEntryQty" IS NOT NULL
          AND "unitId" IS NOT NULL
          AND "enteredQty" <= "totalApprovedQty"
          AND "remainingEntryQty" =
              "totalApprovedQty" - "enteredQty"
        )
        OR
        (
          "quantityMode" = 'UNSPECIFIED'
          AND "totalApprovedQty" IS NULL
          AND "remainingEntryQty" IS NULL
        )
      );
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "vendor_inventory"
      ADD CONSTRAINT "uq_vendor_inventory_material_unit"
      UNIQUE NULLS NOT DISTINCT (
        "vendorMaterialLinkId",
        "vendorMasterItemId",
        "unitId"
      );
    `);

    await queryInterface.addIndex(
      "vendor_inventory",
      ["vendorMaterialLinkId", "isActive"],
      {
        name: "idx_vendor_inventory_link_active",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("vendor_inventory");
  },
};