"use strict";

/** @type {import('sequelize-cli').Migration} */
const {
  AGENT_STATUS,
  AGENT_STATUS_LIST,
  USER_ROLES_LIST,
  USER_ROLES,
} = require("../src/constants/constants");
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Agents", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userTypeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "User_types",
          key: "id",
        },
      },
      userTypeName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      entityName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      mobileNo: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      entityFile: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      addressLine: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      state: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      pincode: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      country: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      gstinNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      gstinDoc: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      panNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      panDoc: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      tanNumber: {
        type: Sequelize.STRING,
      },
      tanDoc: {
        type: Sequelize.STRING,
      },
      remark: {
        type: Sequelize.STRING,
      },
      title: {
        type: Sequelize.STRING,
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      contactMobile: {
        type: Sequelize.STRING,
      },
      contactEmail: {
        type: Sequelize.STRING,
      },
      termsAccepted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      isApproved: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      referenceNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      loginId: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },

      password: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      rejectedReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      isPasswordChanged: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM(...AGENT_STATUS_LIST),
        allowNull: false,
        defaultValue: AGENT_STATUS.PENDING,
      },
      role: {
        type: Sequelize.ENUM(...USER_ROLES_LIST),
        allowNull: false,
        defaultValue: USER_ROLES.USER,
      },
      isRefNoSentByEmail: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isCredentialSentByEmail: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
    await queryInterface.addIndex("Agents", ["status"]);
    await queryInterface.addIndex("Agents", ["isApproved"]);
    await queryInterface.addIndex("Agents", ["userTypeId"]);
    await queryInterface.addIndex("Agents", ["email"]);
    await queryInterface.addIndex("Agents", ["mobileNo"]);
    await queryInterface.addIndex("Agents", ["referenceNumber"]);
    await queryInterface.addIndex("Agents", ["createdAt"]);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Agents");
  },
};
