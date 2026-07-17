"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class TosEirRecord extends Model {
    static associate(models) {
      TosEirRecord.belongsTo(models.TosOperator, {
        foreignKey: "createdBy",
        as: "operator",
      });
    }
  }

  TosEirRecord.init(
    {
      eirNo: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      terminal: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      inGateDateTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      outGateDateTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      containerNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      containerISO: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      containerSize: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      movementType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fullEmpty: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      line: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      trailerNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      oocStatus: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      destinationGroup: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      destinationName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      markedForScanning: {
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
      modelName: "TosEirRecord",
      tableName: "tos_eir_records",
    },
  );

  return TosEirRecord;
};
