'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Gate extends Model {
    static associate(models) {
      Gate.hasMany(models.GateOfficerAssignment, {
        foreignKey: 'gateId',
        as: 'assignments',
      });
    }
  }

  Gate.init({
    gateCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    gateName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    laneName: {
      type: DataTypes.STRING,
    },
    location: {
      type: DataTypes.STRING,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    sequelize,
    modelName: 'Gate',
    tableName: 'gates',
  });

  return Gate;
};
