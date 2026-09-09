'use strict';
const { Model } = require('sequelize');
const {
  VERIFICATION_TYPE_LIST,
  VERIFICATION_STATUS_LIST,
} = require('../src/constants/constants');

module.exports = (sequelize, DataTypes) => {
  /** Audit trail of every event received, hardware or simulated. */
  class GateVerificationEvent extends Model {
    static associate(models) {
      GateVerificationEvent.belongsTo(models.Gate, {
        foreignKey: 'gateId',
        as: 'gate',
      });
    }
  }

  GateVerificationEvent.init({
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    gateId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    verificationType: {
      type: DataTypes.ENUM(...VERIFICATION_TYPE_LIST),
      allowNull: false,
    },
    identifier: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...VERIFICATION_STATUS_LIST),
      allowNull: false,
    },
    matchScore: {
      type: DataTypes.INTEGER,
    },
    reason: {
      type: DataTypes.STRING,
    },
    deviceId: {
      type: DataTypes.STRING,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    rawPayload: {
      type: DataTypes.JSONB,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'HARDWARE',
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'GateVerificationEvent',
    tableName: 'gate_verification_events',
  });

  return GateVerificationEvent;
};
