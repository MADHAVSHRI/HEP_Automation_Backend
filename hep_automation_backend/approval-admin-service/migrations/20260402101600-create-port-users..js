"use strict";

/** @type {import('sequelize-cli').Migration} */
const {
  DEPARTMENT_USER_ACCOUNT_STATUS,
  DEPARTMENT_USER_ACCOUNT_STATUS_LIST,
} = require("../src/constants/constants");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      userName: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      phoneNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      roleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "port_department_roles",
          key: "id",
        },
      },

      departmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "port_departments",
          key: "id",
        },
      },

      isApprovedByAdmin: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      status: {
        type: Sequelize.ENUM(...DEPARTMENT_USER_ACCOUNT_STATUS_LIST),
        allowNull: false,
        defaultValue: DEPARTMENT_USER_ACCOUNT_STATUS.INACTIVE,
      },

      isPasswordChanged: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },

      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("users");
  },
};
