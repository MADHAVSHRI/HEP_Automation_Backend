"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class CustomsOoc extends Model {
    static associate(models) {
      CustomsOoc.belongsTo(models.CustomsOperator, {
        foreignKey: "receivedBy",
        as: "operator",
      });
    }
  }

  CustomsOoc.init(
    {
      containerNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      containerSize: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      oocStatus: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      oocNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      dateTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      receivedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "CustomsOoc",
      tableName: "customs_ooc",
    },
  );

  return CustomsOoc;
};
