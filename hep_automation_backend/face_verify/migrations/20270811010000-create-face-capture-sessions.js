"use strict";

/**
 * One row per shared capture link.
 *
 * Neither token is stored in readable form. Each is 32 bytes of randomness kept
 * only as a SHA-256 digest, so a database dump yields nothing that can open a
 * link or read a photograph.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("face_capture_sessions", {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING(36),
      },

      // The pass system's own handle for the person being photographed. Echoed
      // back on every event so the portal never has to store our id.
      referenceId: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },

      applicantName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      // The agent who issued the link, from the JWT. Scopes every read.
      agentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      captureTokenHash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },

      subscriberTokenHash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },

      status: {
        type: Sequelize.ENUM(
          "PENDING",
          "OPENED",
          "COMPLETED",
          "EXPIRED",
          "CANCELLED"
        ),
        allowNull: false,
        defaultValue: "PENDING",
      },

      livePhotoPath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      livePhotoName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      // Bounded per link, independently of IP rate limits, so a leaked link
      // cannot be hammered from many addresses.
      uploadAttempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      openedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },

      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("face_capture_sessions", ["captureTokenHash"], {
      name: "idx_face_sessions_captureTokenHash",
    });
    await queryInterface.addIndex("face_capture_sessions", ["agentId"], {
      name: "idx_face_sessions_agentId",
    });
    await queryInterface.addIndex("face_capture_sessions", ["expiresAt"], {
      name: "idx_face_sessions_expiresAt",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("face_capture_sessions");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_face_capture_sessions_status";'
    );
  },
};
