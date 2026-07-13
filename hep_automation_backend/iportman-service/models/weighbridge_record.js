"use strict";
const { Model } = require("sequelize");
const { MOVEMENT_TYPE } = require("../src/constants/constants");
module.exports = (sequelize, DataTypes) => {
  class WeighbridgeRecord extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  WeighbridgeRecord.init(
    {
      weighBridgeName: DataTypes.STRING,
      serialNo: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      weighDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      weighTime: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      vehicleNumber: DataTypes.STRING,
      movementType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: MOVEMENT_TYPE.IMPORT,
      },
      cargo: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      clientName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      grossWeight: DataTypes.DECIMAL,
      tareWeight: DataTypes.DECIMAL,
      netWeight: DataTypes.DECIMAL,
      weightUnit: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "WeighbridgeRecord",
      tableName: "weighbridge_records",
    },
  );
  return WeighbridgeRecord;
};
