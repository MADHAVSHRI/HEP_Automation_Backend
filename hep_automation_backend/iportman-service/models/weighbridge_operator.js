"use strict";
const { Model } = require("sequelize");

const CARGO_TYPES = ["LiquidBulk", "DryBulk", "BlockBulk"];

module.exports = (sequelize, DataTypes) => {
  class WeighbridgeOperator extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  WeighbridgeOperator.init(
    {
      loginId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      weighBridgeName: {
        type: DataTypes.STRING,
        allowNull: false,
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
      weighbridgeCode: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      email1: DataTypes.STRING,
      email2: DataTypes.STRING,
      contactPerson1: DataTypes.STRING,
      contactPersonDesignation1: DataTypes.STRING,
      contactPersonPhone1: DataTypes.STRING,
      contactPerson2: DataTypes.STRING,
      contactPersonDesignation2: DataTypes.STRING,
      contactPersonPhone2: DataTypes.STRING,
      location: DataTypes.STRING,
      address: DataTypes.TEXT,
      telNo: DataTypes.STRING,
      faxNo: DataTypes.STRING,
      cargoType: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: { isIn: [CARGO_TYPES] },
      },
    },
    {
      sequelize,
      modelName: "WeighbridgeOperator",
      tableName: "weighbridge_operators",
      defaultScope: {
        // Never expose the password hash by default.
        attributes: { exclude: ["password"] },
      },
      scopes: {
        // Explicit scope for auth flows that need the hash.
        withPassword: { attributes: { include: ["password"] } },
      },
    },
  );
  WeighbridgeOperator.CARGO_TYPES = CARGO_TYPES;
  return WeighbridgeOperator;
};
