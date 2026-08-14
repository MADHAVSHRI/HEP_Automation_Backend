"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("customs_examinations", {
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
      igmNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      billNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      billDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      dateOfExamination: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      chapterHeading: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      examinationFindings: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      discrepancyFound: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdBy: {
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

    await queryInterface.createTable("customs_examination_images", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      examinationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "customs_examinations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fileName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      filePath: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      mimeType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      fileSize: {
        type: Sequelize.INTEGER,
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
    await queryInterface.dropTable("customs_examination_images");
    await queryInterface.dropTable("customs_examinations");
  },
};