"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ==========================
    // ADD COLUMNS
    // ==========================

    await queryInterface.addColumn("pass_persons", "qrUuid", {
      type: Sequelize.UUID,
      allowNull: true,
      unique: true,
    });

    await queryInterface.addColumn("pass_persons", "qrIssuedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("pass_persons", "qrRevoked", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("pass_persons", "qrPdfPath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn("pass_persons", "scanCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("pass_persons", "lastScannedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // ==========================
    // INDEXES
    // ==========================

    await queryInterface.addIndex("pass_persons", ["qrUuid"], {
      name: "idx_pass_persons_qr_uuid",
      unique: true,
    });

    await queryInterface.addIndex("pass_persons", ["passRequestId", "qrUuid"], {
      name: "idx_pass_persons_pass_request_qr",
    });

    await queryInterface.addIndex("pass_persons", ["qrRevoked"], {
      name: "idx_pass_persons_qr_revoked",
    });

    await queryInterface.addIndex("pass_persons", ["lastScannedAt"], {
      name: "idx_pass_persons_last_scanned",
    });
  },

  async down(queryInterface) {
    // ==========================
    // REMOVE INDEXES
    // ==========================

    await queryInterface.removeIndex(
      "pass_persons",
      "idx_pass_persons_qr_uuid",
    );

    await queryInterface.removeIndex(
      "pass_persons",
      "idx_pass_persons_pass_request_qr",
    );

    await queryInterface.removeIndex(
      "pass_persons",
      "idx_pass_persons_qr_revoked",
    );

    await queryInterface.removeIndex(
      "pass_persons",
      "idx_pass_persons_last_scanned",
    );

    // ==========================
    // REMOVE COLUMNS
    // ==========================

    await queryInterface.removeColumn("pass_persons", "qrUuid");

    await queryInterface.removeColumn("pass_persons", "qrIssuedAt");

    await queryInterface.removeColumn("pass_persons", "qrRevoked");

    await queryInterface.removeColumn("pass_persons", "qrPdfPath");

    await queryInterface.removeColumn("pass_persons", "scanCount");

    await queryInterface.removeColumn("pass_persons", "lastScannedAt");
  },
};
