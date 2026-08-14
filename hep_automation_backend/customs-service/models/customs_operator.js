"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class CustomsOperator extends Model {
    static associate(models) {
      CustomsOperator.hasMany(models.CustomsExamination, {
        foreignKey: "createdBy",
        as: "examinations",
      });
    }
  }

  CustomsOperator.init(
    {
      loginId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
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
      modelName: "CustomsOperator",
      tableName: "customs_operators",
      defaultScope: {
        attributes: { exclude: ["password"] },
      },
      scopes: {
        withPassword: { attributes: { include: ["password"] } },
      },
    },
  );

  return CustomsOperator;
};