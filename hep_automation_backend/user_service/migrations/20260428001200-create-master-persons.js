"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("master_persons", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      agentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Agents",
          key: "id",
        },
      },

      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      aadharNo: {
        type: Sequelize.STRING(12),
        allowNull: false,
        unique: true,
      },

      mobile: Sequelize.STRING(10),

      email: Sequelize.STRING(150),

      nationality: Sequelize.STRING(20),

      designationId: Sequelize.INTEGER,

      photoFilePath: Sequelize.STRING(500),
      photoFileName: Sequelize.STRING(150),

      aadharPDFFilePath: Sequelize.STRING(500),
      aadharPDFFileName: Sequelize.STRING(150),

      idProofFilePath: Sequelize.STRING(500),
      idProofFileName: Sequelize.STRING(150),

      idProofType: Sequelize.STRING(50),
      idProofNumber: Sequelize.STRING(100),

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },

      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("master_persons", ["agentId"]);
    await queryInterface.addIndex("master_persons", ["aadharNo"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("master_persons");
  },
};
