"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("vendor_material_links", {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      referenceNo: {
        type: Sequelize.STRING(40),
        allowNull: false,
        unique: true,
      },

      tokenHash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },

      tokenCipher: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      createdByUserId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      departmentId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: "port_departments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      departmentName: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      companyName: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      vendorEmail: {
        type: Sequelize.STRING(254),
        allowNull: false,
      },

      vendorMobile: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },

      purposeOfVisitId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "visit_purposes",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      purposeOther: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      validFrom: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      validTo: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      hasWorkOrder: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      referenceDocumentNo: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      workOrderFilePath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      workOrderOriginalName: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      remarks: {
        type: Sequelize.STRING(1000),
        allowNull: true,
      },

      vendorRequestLimit: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      totalVendorSubmissions: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "ACTIVE",
      },

      lastEmailSentAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      revokedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      revokedByUserId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      revokeReason: {
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
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE "vendor_material_links"
      ADD CONSTRAINT "chk_vendor_material_links_status"
      CHECK (
        "status" IN (
          'ACTIVE',
          'EXPIRED',
          'REVOKED',
          'DISABLED'
        )
      );

      ALTER TABLE "vendor_material_links"
      ADD CONSTRAINT "chk_vendor_material_links_validity"
      CHECK ("validTo" >= "validFrom");

      ALTER TABLE "vendor_material_links"
      ADD CONSTRAINT "chk_vendor_material_links_mobile"
      CHECK ("vendorMobile" ~ '^[0-9]{10}$');

      ALTER TABLE "vendor_material_links"
      ADD CONSTRAINT "chk_vendor_material_links_submission_limit"
      CHECK (
        "vendorRequestLimit" >= 1
        AND "totalVendorSubmissions" >= 0
        AND "totalVendorSubmissions" <= "vendorRequestLimit"
      );

      ALTER TABLE "vendor_material_links"
      ADD CONSTRAINT "chk_vendor_material_links_work_order"
      CHECK (
        "hasWorkOrder" = FALSE
        OR (
          "referenceDocumentNo" IS NOT NULL
          AND LENGTH(TRIM("referenceDocumentNo")) > 0
        )
      );

      ALTER TABLE "vendor_material_links"
      ADD CONSTRAINT "chk_vendor_material_links_revoke"
      CHECK (
        "status" <> 'REVOKED'
        OR (
          "revokedAt" IS NOT NULL
          AND "revokeReason" IS NOT NULL
          AND LENGTH(TRIM("revokeReason")) > 0
        )
      );
    `);

    await queryInterface.addIndex(
      "vendor_material_links",
      ["departmentId", "createdAt"],
      {
        name: "idx_vendor_material_links_department_created",
      }
    );

    await queryInterface.addIndex(
      "vendor_material_links",
      ["createdByUserId", "createdAt"],
      {
        name: "idx_vendor_material_links_creator_created",
      }
    );

    await queryInterface.addIndex(
      "vendor_material_links",
      ["status", "validTo"],
      {
        name: "idx_vendor_material_links_status_valid_to",
      }
    );

    await queryInterface.addIndex(
      "vendor_material_links",
      ["vendorEmail"],
      {
        name: "idx_vendor_material_links_vendor_email",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("vendor_material_links");
  },
};