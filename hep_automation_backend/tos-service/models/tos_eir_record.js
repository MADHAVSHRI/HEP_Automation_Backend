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
        allowNull: true,
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
        allowNull: true,
      },
      destinationGroup: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      destinationName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      markedForScanning: {
        type: DataTypes.STRING,
        allowNull: true,
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
      indexes: [
        {
          unique: true,
          fields: ["eirNo", "containerNumber"],
          name: "idx_tos_eir_records_eirno_containerno_unique",
        },
      ],
    },
  );

  return TosEirRecord;
};
