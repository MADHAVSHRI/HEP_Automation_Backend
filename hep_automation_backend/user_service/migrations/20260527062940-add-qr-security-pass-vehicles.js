"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ==========================
    // ADD COLUMNS
    // ==========================

    await queryInterface.addColumn("pass_vehicles", "qrUuid", {
      type: Sequelize.UUID,
      allowNull: true,
      unique: true,
    });

    await queryInterface.addColumn("pass_vehicles", "qrIssuedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("pass_vehicles", "qrRevoked", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("pass_vehicles", "qrPdfPath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn("pass_vehicles", "scanCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("pass_vehicles", "lastScannedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // ==========================
    // INDEXES
    // ==========================

    await queryInterface.addIndex("pass_vehicles", ["qrUuid"], {
      name: "idx_pass_vehicles_qr_uuid",
      unique: true,
    });

    await queryInterface.addIndex(
      "pass_vehicles",
      ["passRequestId", "qrUuid"],
      {
        name: "idx_pass_vehicles_pass_request_qr",
      },
    );

    await queryInterface.addIndex("pass_vehicles", ["qrRevoked"], {
      name: "idx_pass_vehicles_qr_revoked",
    });

    await queryInterface.addIndex("pass_vehicles", ["lastScannedAt"], {
      name: "idx_pass_vehicles_last_scanned",
    });
  },

  async down(queryInterface) {
    // ==========================
    // REMOVE INDEXES
    // ==========================

    await queryInterface.removeIndex(
      "pass_vehicles",
      "idx_pass_vehicles_qr_uuid",
    );

    await queryInterface.removeIndex(
      "pass_vehicles",
      "idx_pass_vehicles_pass_request_qr",
    );

    await queryInterface.removeIndex(
      "pass_vehicles",
      "idx_pass_vehicles_qr_revoked",
    );

    await queryInterface.removeIndex(
      "pass_vehicles",
      "idx_pass_vehicles_last_scanned",
    );

    // ==========================
    // REMOVE COLUMNS
    // ==========================

    await queryInterface.removeColumn("pass_vehicles", "qrUuid");

    await queryInterface.removeColumn("pass_vehicles", "qrIssuedAt");

    await queryInterface.removeColumn("pass_vehicles", "qrRevoked");

    await queryInterface.removeColumn("pass_vehicles", "qrPdfPath");

    await queryInterface.removeColumn("pass_vehicles", "scanCount");

    await queryInterface.removeColumn("pass_vehicles", "lastScannedAt");
  },
};
