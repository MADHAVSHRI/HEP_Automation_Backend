"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class TosForm13 extends Model {
    static associate(models) {
      TosForm13.hasMany(models.TosForm13Container, {
        foreignKey: "form13Id",
        as: "containers",
      });

      TosForm13.belongsTo(models.TosOperator, {
        foreignKey: "createdBy",
        as: "operator",
      });
    }
  }

  TosForm13.init(
    {
      form13No: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      trailerNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      terminal: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "TosForm13",
      tableName: "tos_form13",
    },
  );

  return TosForm13;
};
