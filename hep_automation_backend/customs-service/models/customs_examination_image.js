"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class CustomsExaminationImage extends Model {
    static associate(models) {
      CustomsExaminationImage.belongsTo(models.CustomsExamination, {
        foreignKey: "examinationId",
        as: "examination",
      });
    }
  }

  CustomsExaminationImage.init(
    {
      examinationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      fileName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      filePath: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      mimeType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileSize: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "CustomsExaminationImage",
      tableName: "customs_examination_images",
    },
  );

  return CustomsExaminationImage;
};