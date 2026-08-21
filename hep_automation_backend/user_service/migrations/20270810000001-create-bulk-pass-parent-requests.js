"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("bulk_pass_parent_requests", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      // Identification
      tracking_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },

      shared_token: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },

      // Company & Applicant Information
      company_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      applicant_email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      applicant_mobile: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      visitor_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      // Pass Requirements
      no_of_persons: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      no_of_vehicles: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      payment_mode: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },

      purpose: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // Validity Period
      validity_from: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      validity_upto: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      // Work Order
      work_order_required: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      ref_doc_no: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // Token Management
      token_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      // Approval Time Window (when can submit multiple passes)
      approved_time_from: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      approved_time_upto: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // Status and Approval
      status: {
        type: Sequelize.STRING(50),
        defaultValue: "PENDING_ADMIN_APPROVAL",
      },

      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      approved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      approved_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      rejected_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      rejected_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
    });

    // Add indexes
    await queryInterface.addIndex("bulk_pass_parent_requests", ["status"], {
      name: "idx_status",
    });

    await queryInterface.addIndex(
      "bulk_pass_parent_requests",
      ["applicant_email"],
      {
        name: "idx_email",
      }
    );

    await queryInterface.addIndex(
      "bulk_pass_parent_requests",
      ["shared_token"],
      {
        name: "idx_token",
      }
    );

    await queryInterface.addIndex(
      "bulk_pass_parent_requests",
      ["tracking_number"],
      {
        name: "idx_tracking",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("bulk_pass_parent_requests");
  },
};
