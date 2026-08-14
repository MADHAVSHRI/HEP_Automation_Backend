"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class CustomsRapiscan extends Model {
    static associate(models) {
      CustomsRapiscan.belongsTo(models.CustomsOperator, {
        foreignKey: "createdBy",
        as: "operator",
      });
    }
  }

  CustomsRapiscan.init(
    {
      containerNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      containerSize: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      scanningStatus: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      scanningDateTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "CustomsRapiscan",
      tableName: "customs_rapiscan",
    },
  );

  return CustomsRapiscan;
};
