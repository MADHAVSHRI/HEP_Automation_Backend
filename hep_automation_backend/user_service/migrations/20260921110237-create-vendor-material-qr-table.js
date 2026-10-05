"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "vendor_material_qr",
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
          unique: true,
          references: {
            model: "vendor_material_links",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },

        qrCode: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true,
        },

        qrFilePath: {
          type: Sequelize.STRING(500),
          allowNull: true,
        },

        qrVersion: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },

        validFrom: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },

        validTo: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },

        generatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },

        lastUpdatedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },

        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },

        disabledAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },

        disabledByUserId: {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },

        disableReason: {
          type: Sequelize.STRING(500),
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
      ALTER TABLE "vendor_material_qr"
      ADD CONSTRAINT "chk_vendor_material_qr_version"
      CHECK ("qrVersion" >= 1);

      ALTER TABLE "vendor_material_qr"
      ADD CONSTRAINT "chk_vendor_material_qr_validity"
      CHECK ("validTo" >= "validFrom");

      ALTER TABLE "vendor_material_qr"
      ADD CONSTRAINT "chk_vendor_material_qr_disabled"
      CHECK (
        (
          "isActive" = TRUE
          AND "disabledAt" IS NULL
          AND "disableReason" IS NULL
        )
        OR
        (
          "isActive" = FALSE
          AND "disabledAt" IS NOT NULL
          AND "disableReason" IS NOT NULL
          AND LENGTH(TRIM("disableReason")) > 0
        )
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable(
      "vendor_material_qr"
    );
  },
};