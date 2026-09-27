"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ============================================================
    // VENDOR PERSON QR SECURITY
    // ============================================================

    await queryInterface.addColumn("vendor_pass_persons", "qrUuid", {
      type: Sequelize.UUID,
      allowNull: true,
      unique: true,
    });

    await queryInterface.addColumn("vendor_pass_persons", "qrIssuedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("vendor_pass_persons", "qrRevoked", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("vendor_pass_persons", "qrPdfPath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn("vendor_pass_persons", "scanCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("vendor_pass_persons", "lastScannedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("vendor_pass_persons", "isActive", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn("vendor_pass_persons", "isBlocked", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // ============================================================
    // VENDOR VEHICLE QR SECURITY
    // ============================================================

    await queryInterface.addColumn("vendor_pass_vehicles", "qrUuid", {
      type: Sequelize.UUID,
      allowNull: true,
      unique: true,
    });

    await queryInterface.addColumn("vendor_pass_vehicles", "qrIssuedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("vendor_pass_vehicles", "qrRevoked", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("vendor_pass_vehicles", "qrPdfPath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn("vendor_pass_vehicles", "scanCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("vendor_pass_vehicles", "lastScannedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("vendor_pass_vehicles", "isActive", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn("vendor_pass_vehicles", "isBlocked", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // ============================================================
    // INDEXES
    // ============================================================

    await queryInterface.addIndex("vendor_pass_persons", ["qrUuid"], {
      name: "idx_vendor_pass_persons_qr_uuid",
      unique: true,
    });

    await queryInterface.addIndex(
      "vendor_pass_persons",
      ["vendorPassRequestId", "qrUuid"],
      {
        name: "idx_vendor_pass_persons_request_qr",
      },
    );

    await queryInterface.addIndex("vendor_pass_persons", ["qrRevoked"], {
      name: "idx_vendor_pass_persons_qr_revoked",
    });

    await queryInterface.addIndex("vendor_pass_persons", ["lastScannedAt"], {
      name: "idx_vendor_pass_persons_last_scanned",
    });

    await queryInterface.addIndex("vendor_pass_vehicles", ["qrUuid"], {
      name: "idx_vendor_pass_vehicles_qr_uuid",
      unique: true,
    });

    await queryInterface.addIndex(
      "vendor_pass_vehicles",
      ["vendorPassRequestId", "qrUuid"],
      {
        name: "idx_vendor_pass_vehicles_request_qr",
      },
    );

    await queryInterface.addIndex("vendor_pass_vehicles", ["qrRevoked"], {
      name: "idx_vendor_pass_vehicles_qr_revoked",
    });

    await queryInterface.addIndex("vendor_pass_vehicles", ["lastScannedAt"], {
      name: "idx_vendor_pass_vehicles_last_scanned",
    });
  },

  async down(queryInterface) {
    // ============================================================
    // REMOVE VENDOR PERSON INDEXES
    // ============================================================

    await queryInterface.removeIndex(
      "vendor_pass_persons",
      "idx_vendor_pass_persons_qr_uuid",
    );

    await queryInterface.removeIndex(
      "vendor_pass_persons",
      "idx_vendor_pass_persons_request_qr",
    );

    await queryInterface.removeIndex(
      "vendor_pass_persons",
      "idx_vendor_pass_persons_qr_revoked",
    );

    await queryInterface.removeIndex(
      "vendor_pass_persons",
      "idx_vendor_pass_persons_last_scanned",
    );

    // ============================================================
    // REMOVE VENDOR VEHICLE INDEXES
    // ============================================================

    await queryInterface.removeIndex(
      "vendor_pass_vehicles",
      "idx_vendor_pass_vehicles_qr_uuid",
    );

    await queryInterface.removeIndex(
      "vendor_pass_vehicles",
      "idx_vendor_pass_vehicles_request_qr",
    );

    await queryInterface.removeIndex(
      "vendor_pass_vehicles",
      "idx_vendor_pass_vehicles_qr_revoked",
    );

    await queryInterface.removeIndex(
      "vendor_pass_vehicles",
      "idx_vendor_pass_vehicles_last_scanned",
    );

    // ============================================================
    // REMOVE VENDOR PERSON COLUMNS
    // ============================================================

    await queryInterface.removeColumn("vendor_pass_persons", "qrUuid");
    await queryInterface.removeColumn("vendor_pass_persons", "qrIssuedAt");
    await queryInterface.removeColumn("vendor_pass_persons", "qrRevoked");
    await queryInterface.removeColumn("vendor_pass_persons", "qrPdfPath");
    await queryInterface.removeColumn("vendor_pass_persons", "scanCount");
    await queryInterface.removeColumn("vendor_pass_persons", "lastScannedAt");
    await queryInterface.removeColumn("vendor_pass_persons", "isActive");
    await queryInterface.removeColumn("vendor_pass_persons", "isBlocked");

    // ============================================================
    // REMOVE VENDOR VEHICLE COLUMNS
    // ============================================================

    await queryInterface.removeColumn("vendor_pass_vehicles", "qrUuid");
    await queryInterface.removeColumn("vendor_pass_vehicles", "qrIssuedAt");
    await queryInterface.removeColumn("vendor_pass_vehicles", "qrRevoked");
    await queryInterface.removeColumn("vendor_pass_vehicles", "qrPdfPath");
    await queryInterface.removeColumn("vendor_pass_vehicles", "scanCount");
    await queryInterface.removeColumn("vendor_pass_vehicles", "lastScannedAt");
    await queryInterface.removeColumn("vendor_pass_vehicles", "isActive");
    await queryInterface.removeColumn("vendor_pass_vehicles", "isBlocked");
  },
};
