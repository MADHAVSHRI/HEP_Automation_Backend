"use strict";

/**
 * Migration: Individual approval for bulk pass persons
 *
 * Changes:
 * 1. Add `approvalStatus` column to bulk_pass_persons
 *    (PENDING | APPROVED | REJECTED — default PENDING)
 * 2. Add `approvalReason` column for rejection reason per person
 * 3. Add `approvedBy` and `approvedAt` columns for audit trail
 * 4. Make `aadhaarCardPath` effectively mandatory (already exists — no DDL
 *    change needed here; enforcement is done at the application layer).
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. approvalStatus
    await queryInterface.addColumn("bulk_pass_persons", "approvalStatus", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "PENDING",
    });

    // 2. approvalReason (rejection reason or approval remarks)
    await queryInterface.addColumn("bulk_pass_persons", "approvalReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // 3. approvedBy (userId of the traffic officer who actioned this person)
    await queryInterface.addColumn("bulk_pass_persons", "approvedBy", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // 4. approvedAt
    await queryInterface.addColumn("bulk_pass_persons", "approvedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Index for fast per-batch + status queries
    await queryInterface.addIndex("bulk_pass_persons", ["batchId", "approvalStatus"], {
      name: "idx_bpp_batch_approval_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("bulk_pass_persons", "idx_bpp_batch_approval_status");
    await queryInterface.removeColumn("bulk_pass_persons", "approvedAt");
    await queryInterface.removeColumn("bulk_pass_persons", "approvedBy");
    await queryInterface.removeColumn("bulk_pass_persons", "approvalReason");
    await queryInterface.removeColumn("bulk_pass_persons", "approvalStatus");
  },
};
