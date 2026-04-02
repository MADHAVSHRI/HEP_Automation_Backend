"use strict";
const { Model } = require("sequelize");
const {
  AGENT_STATUS,
  AGENT_STATUS_LIST,
  USER_ROLES_LIST,
  USER_ROLES,
} = require("../src/constants/constants");
module.exports = (sequelize, DataTypes) => {
  class Agent extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Agent.init(
    {
      userTypeId: DataTypes.INTEGER,
      userTypeName: DataTypes.STRING,
      entityName: DataTypes.STRING,
      mobileNo: DataTypes.STRING,
      email: DataTypes.STRING,
      entityFile: DataTypes.STRING,
      addressLine: DataTypes.STRING,
      city: DataTypes.STRING,
      state: DataTypes.STRING,
      pincode: DataTypes.STRING,
      country: DataTypes.STRING,
      gstinNumber: DataTypes.STRING,
      gstinDoc: DataTypes.STRING,
      panNumber: DataTypes.STRING,
      panDoc: DataTypes.STRING,
      tanNumber: DataTypes.STRING,
      tanDoc: DataTypes.STRING,
      remark: DataTypes.STRING,
      title: DataTypes.STRING,
      firstName: DataTypes.STRING,
      lastName: DataTypes.STRING,
      contactMobile: DataTypes.STRING,
      contactEmail: DataTypes.STRING,
      termsAccepted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isApproved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: AGENT_STATUS.PENDING,
      },
      referenceNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: USER_ROLES.USER,
      },
      isRefNoSentByEmail: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isCredentialSentByEmail: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Agent",
    },
  );
  return Agent;
};
