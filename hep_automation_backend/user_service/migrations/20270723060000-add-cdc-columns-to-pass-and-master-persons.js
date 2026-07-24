"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add cdc columns to pass_persons
    await queryInterface.addColumn("pass_persons", "cdcNumber", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn("pass_persons", "cdcDocumentPath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn("pass_persons", "cdcDocumentName", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    // Add cdc columns to master_persons
    await queryInterface.addColumn("master_persons", "cdcNumber", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn("master_persons", "cdcDocumentPath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn("master_persons", "cdcDocumentName", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("pass_persons", "cdcNumber");
    await queryInterface.removeColumn("pass_persons", "cdcDocumentPath");
    await queryInterface.removeColumn("pass_persons", "cdcDocumentName");

    await queryInterface.removeColumn("master_persons", "cdcNumber");
    await queryInterface.removeColumn("master_persons", "cdcDocumentPath");
    await queryInterface.removeColumn("master_persons", "cdcDocumentName");
  },
};
