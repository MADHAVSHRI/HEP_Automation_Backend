"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    /* PERSON FILES */

    await queryInterface.addColumn("pass_persons", "requisitionLetterPath", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("pass_persons", "requisitionLetterName", {
      type: Sequelize.STRING,
    });
  },

  async down(queryInterface) {},
};
