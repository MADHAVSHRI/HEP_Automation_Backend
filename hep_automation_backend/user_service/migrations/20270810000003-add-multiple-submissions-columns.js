"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if multipleSubmissionsEnabled column exists
    const tableDescription = await queryInterface.describeTable("bulk_pass_batches");
    
    if (!tableDescription.multipleSubmissionsEnabled) {
      // Add multipleSubmissionsEnabled column
      // Indicates whether this batch allows multiple submissions (reusable link)
      await queryInterface.addColumn("bulk_pass_batches", "multipleSubmissionsEnabled", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    // Check if parent_request_id column exists
    if (!tableDescription.parent_request_id) {
      // Add parent_request_id column
      // Links child batches to their parent request (either public or department-created)
      // Nullable because parent batches themselves don't have a parent
      await queryInterface.addColumn("bulk_pass_batches", "parent_request_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    // Check if submission_number column exists
    if (!tableDescription.submission_number) {
      // Add submission_number column
      // Sequential counter for child batches under the same parent (1, 2, 3, etc.)
      await queryInterface.addColumn("bulk_pass_batches", "submission_number", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      });
    }

    // Check if request_source column exists
    if (!tableDescription.request_source) {
      // Add request_source column
      // Differentiates between department-initiated and public website requests
      await queryInterface.addColumn("bulk_pass_batches", "request_source", {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "DEPARTMENT",
      });
    }

    // Check and add indexes if they don't exist
    const indexes = await queryInterface.showIndex("bulk_pass_batches");
    const indexNames = indexes.map(idx => idx.name);

    if (!indexNames.includes("idx_parent_request") && !indexNames.includes("idx_batches_parent_request")) {
      // Add index on parent_request_id for efficient child batch lookups
      await queryInterface.addIndex("bulk_pass_batches", ["parent_request_id"], {
        name: "idx_parent_request",
      });
    }

    if (!indexNames.includes("idx_request_source") && !indexNames.includes("idx_batches_request_source")) {
      // Add index on request_source for filtering by source type
      await queryInterface.addIndex("bulk_pass_batches", ["request_source"], {
        name: "idx_request_source",
      });
    }

    if (!indexNames.includes("idx_multiple_submissions")) {
      // Add index on multipleSubmissionsEnabled for filtering parent batches
      await queryInterface.addIndex("bulk_pass_batches", ["multipleSubmissionsEnabled"], {
        name: "idx_multiple_submissions",
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Get current indexes
    const indexes = await queryInterface.showIndex("bulk_pass_batches");
    const indexNames = indexes.map(idx => idx.name);

    // Remove indexes if they exist
    if (indexNames.includes("idx_multiple_submissions")) {
      await queryInterface.removeIndex("bulk_pass_batches", "idx_multiple_submissions");
    }
    
    if (indexNames.includes("idx_request_source")) {
      await queryInterface.removeIndex("bulk_pass_batches", "idx_request_source");
    }
    
    if (indexNames.includes("idx_parent_request")) {
      await queryInterface.removeIndex("bulk_pass_batches", "idx_parent_request");
    }

    // Get current table structure
    const tableDescription = await queryInterface.describeTable("bulk_pass_batches");

    // Remove columns if they exist
    if (tableDescription.request_source) {
      await queryInterface.removeColumn("bulk_pass_batches", "request_source");
    }
    
    if (tableDescription.submission_number) {
      await queryInterface.removeColumn("bulk_pass_batches", "submission_number");
    }
    
    if (tableDescription.parent_request_id) {
      await queryInterface.removeColumn("bulk_pass_batches", "parent_request_id");
    }
    
    if (tableDescription.multipleSubmissionsEnabled) {
      await queryInterface.removeColumn("bulk_pass_batches", "multipleSubmissionsEnabled");
    }
  },
};
