"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class CustomsExamination extends Model {
    static associate(models) {
      CustomsExamination.hasMany(models.CustomsExaminationImage, {
        foreignKey: "examinationId",
        as: "images",
      });

      CustomsExamination.belongsTo(models.CustomsOperator, {
        foreignKey: "createdBy",
        as: "operator",
      });
    }
  }

  CustomsExamination.init(
    {
      containerNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      igmNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // Retained for existing records; no longer sent via public API
      billNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // Retained for existing records; no longer sent via public API
      billDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      dateOfExamination: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      // Retained for existing records; no longer sent via public API
      chapterHeading: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      examinationFindings: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      discrepancyFound: {
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
      modelName: "CustomsExamination",
      tableName: "customs_examinations",
    },
  );

  return CustomsExamination;
};