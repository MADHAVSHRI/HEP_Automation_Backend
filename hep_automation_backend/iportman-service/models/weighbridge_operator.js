"use strict";
const { Model } = require("sequelize");
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
  return WeighbridgeOperator;
};
