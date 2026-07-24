"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Make Aadhaar & ID proof fields nullable in master_persons so that
    // seafarers/foreigners using passport (without Aadhaar or separate ID proof copy) can be inserted.
    await queryInterface.changeColumn("master_persons", "aadharNo", {
      type: Sequelize.STRING(12),
      allowNull: true,
    });

    await queryInterface.changeColumn("master_persons", "aadharPDFFilePATH", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.changeColumn("master_persons", "aadharPDFFileName", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.changeColumn("master_persons", "idProofType", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });

    await queryInterface.changeColumn("master_persons", "idProofNumber", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.changeColumn("master_persons", "idProofFilePath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.changeColumn("master_persons", "idProofFileName", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("master_persons", "aadharNo", {
      type: Sequelize.STRING(12),
      allowNull: false,
    });

    await queryInterface.changeColumn("master_persons", "aadharPDFFilePATH", {
      type: Sequelize.STRING(500),
      allowNull: false,
    });

    await queryInterface.changeColumn("master_persons", "aadharPDFFileName", {
      type: Sequelize.STRING(150),
      allowNull: false,
    });

    await queryInterface.changeColumn("master_persons", "idProofType", {
      type: Sequelize.STRING(50),
      allowNull: false,
    });

    await queryInterface.changeColumn("master_persons", "idProofNumber", {
      type: Sequelize.STRING(100),
      allowNull: false,
    });

    await queryInterface.changeColumn("master_persons", "idProofFilePath", {
      type: Sequelize.STRING(500),
      allowNull: false,
    });

    await queryInterface.changeColumn("master_persons", "idProofFileName", {
      type: Sequelize.STRING(150),
      allowNull: false,
    });
  },
};
