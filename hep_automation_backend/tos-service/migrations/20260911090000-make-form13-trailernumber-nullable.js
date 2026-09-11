"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("tos_form13", "trailerNumber", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("tos_form13", "trailerNumber", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
