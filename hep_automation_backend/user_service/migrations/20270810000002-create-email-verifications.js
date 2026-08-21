"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("email_verifications", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      otp_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: "6-digit OTP stored as bcrypt hash for security",
      },

      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: "OTP valid for 10 minutes from creation",
      },

      verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },

      attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: "Track failed verification attempts (max 3)",
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add composite index on email and expires_at for efficient querying
    await queryInterface.addIndex("email_verifications", ["email", "expires_at"], {
      name: "idx_email_expiry",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("email_verifications");
  },
};
