"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("port_department_roles", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      roleName: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      roleCode: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },

      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Index for faster search
    await queryInterface.addIndex("port_department_roles", ["roleName"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("port_department_roles");
  },
};
