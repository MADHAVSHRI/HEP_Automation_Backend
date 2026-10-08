"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("account_deletion_requests", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "References Agents.id or users.id depending on userType",
      },

      userType: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "agent",
        comment: "agent | port_user | admin",
      },

      loginId: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: "The loginId / userName used to log in",
      },

      email: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Optional reason provided by the user for requesting deletion",
      },

      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "PENDING",
        comment: "PENDING | APPROVED | REJECTED",
      },

      ipAddress: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: "IP address of the request origin",
      },

      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Browser / device user-agent string",
      },

      reviewedBy: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: "Admin loginId who reviewed the request",
      },

      reviewedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      adminNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Internal notes added by the reviewing admin",
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

    // Indexes — match those created in accountDeletionSchema.js initTable()
    await queryInterface.addIndex("account_deletion_requests", ["loginId"], {
      name: "idx_account_deletion_login_id",
    });

    await queryInterface.addIndex("account_deletion_requests", ["status"], {
      name: "idx_account_deletion_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "account_deletion_requests",
      "idx_account_deletion_login_id"
    );
    await queryInterface.removeIndex(
      "account_deletion_requests",
      "idx_account_deletion_status"
    );
    await queryInterface.dropTable("account_deletion_requests");
  },
};
