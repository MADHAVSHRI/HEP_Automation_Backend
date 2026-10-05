"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "vendor_master_items",
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

        name: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },

        materialType: {
          type: Sequelize.STRING(30),
          allowNull: false,
        },

        lastUsedUnitId: {
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
      ALTER TABLE "vendor_master_items"
      ADD CONSTRAINT "chk_vendor_master_items_type"
      CHECK (
        "materialType" IN (
          'RETURNABLE',
          'NON_RETURNABLE'
        )
      );

      ALTER TABLE "vendor_master_items"
      ADD CONSTRAINT "chk_vendor_master_items_name"
      CHECK (LENGTH(TRIM("name")) > 0);
    `);

    await queryInterface.addConstraint(
      "vendor_master_items",
      {
        fields: [
          "vendorMaterialLinkId",
          "name",
          "materialType",
        ],
        type: "unique",
        name: "uq_vendor_master_item",
      }
    );

    await queryInterface.addIndex(
      "vendor_master_items",
      ["vendorMaterialLinkId", "isActive"],
      {
        name: "idx_vendor_master_items_link_active",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("vendor_master_items");
  },
};