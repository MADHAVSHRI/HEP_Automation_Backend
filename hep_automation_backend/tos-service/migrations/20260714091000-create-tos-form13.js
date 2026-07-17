"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("tos_form13", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      form13No: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      trailerNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      terminal: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "tos_operators",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
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

    await queryInterface.createTable("tos_form13_containers", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      form13Id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "tos_form13",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      containerNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      containerSize: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      containerISO: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      containerType: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      movementType: {
        type: Sequelize.STRING,
        allowNull: false,
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("tos_form13_containers");
    await queryInterface.dropTable("tos_form13");
  },
};
