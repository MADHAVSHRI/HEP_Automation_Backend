"use strict";

const {
  VERIFICATION_TYPE_LIST,
  VERIFICATION_STATUS_LIST,
} = require("../src/constants/constants");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("gate_verification_events", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      // Public id carried to the mobile client; also used to de-duplicate
      // repeated deliveries from a device.
      eventId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
      },

      gateId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "gates",
          key: "id",
        },
      },

      verificationType: {
        type: Sequelize.ENUM(...VERIFICATION_TYPE_LIST),
        allowNull: false,
      },

      identifier: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      status: {
        type: Sequelize.ENUM(...VERIFICATION_STATUS_LIST),
        allowNull: false,
      },

      matchScore: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      reason: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      deviceId: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // Normalised payload delivered to the client, kept for replay/audit.
      payload: {
        type: Sequelize.JSONB,
        allowNull: false,
      },

      // Untouched device body, so a hardware format change stays diagnosable.
      rawPayload: {
        type: Sequelize.JSONB,
        allowNull: true,
      },

      source: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "HARDWARE",
      },

      occurredAt: {
        type: Sequelize.DATE,
        allowNull: false,
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

    await queryInterface.addIndex("gate_verification_events", [
      "gateId",
      "occurredAt",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("gate_verification_events");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_gate_verification_events_verificationType";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_gate_verification_events_status";',
    );
  },
};
