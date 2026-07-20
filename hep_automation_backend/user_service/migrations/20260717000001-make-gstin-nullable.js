"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("Agents", "gstinNumber", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn("Agents", "gstinDoc", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("Agents", "gstinNumber", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn("Agents", "gstinDoc", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
