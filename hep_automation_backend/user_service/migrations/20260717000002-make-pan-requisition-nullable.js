"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("Agents", "requisitionLetter", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn("Agents", "panNumber", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn("Agents", "panDoc", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("Agents", "requisitionLetter", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn("Agents", "panNumber", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn("Agents", "panDoc", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
