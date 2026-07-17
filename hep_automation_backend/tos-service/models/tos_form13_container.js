"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class TosForm13Container extends Model {
    static associate(models) {
      TosForm13Container.belongsTo(models.TosForm13, {
        foreignKey: "form13Id",
        as: "form13",
      });
    }
  }

  TosForm13Container.init(
    {
      form13Id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      containerNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      containerSize: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      containerISO: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      containerType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      movementType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "TosForm13Container",
      tableName: "tos_form13_containers",
    },
  );

  return TosForm13Container;
};
