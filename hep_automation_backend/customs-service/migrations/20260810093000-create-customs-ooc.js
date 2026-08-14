"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("customs_ooc", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      containerNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      containerSize: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      oocStatus: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      oocNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      dateTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      receivedBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "customs_operators",
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("customs_ooc");
  },
};
