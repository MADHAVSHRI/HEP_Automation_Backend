'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  /**
   * Which CISF officer (users.id) is posted to which gate. This table is the
   * only authority on gate access — a client never states its own gates.
   */
  class GateOfficerAssignment extends Model {
    static associate(models) {
      GateOfficerAssignment.belongsTo(models.Gate, {
        foreignKey: 'gateId',
        as: 'gate',
      });
    }
  }

  GateOfficerAssignment.init({
    gateId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    sequelize,
    modelName: 'GateOfficerAssignment',
    tableName: 'gate_officer_assignments',
  });

  return GateOfficerAssignment;
};
