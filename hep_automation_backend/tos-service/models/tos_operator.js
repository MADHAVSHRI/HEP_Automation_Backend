"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class TosOperator extends Model {
    static associate(models) {
      TosOperator.hasMany(models.TosForm13, {
        foreignKey: "createdBy",
        as: "form13Records",
      });

      TosOperator.hasMany(models.TosEirRecord, {
        foreignKey: "createdBy",
        as: "eirRecords",
      });
    }
  }

  TosOperator.init(
    {
      loginId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      terminal: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "TosOperator",
      tableName: "tos_operators",
      defaultScope: {
        attributes: { exclude: ["password"] },
      },
      scopes: {
        withPassword: { attributes: { include: ["password"] } },
      },
    },
  );

  return TosOperator;
};
