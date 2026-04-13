"use strict";
const { all } = require("../src/routes");

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.sequelize.query(`
      CREATE SEQUENCE agent_reference_seq
      START 1
      INCREMENT 1
    `);

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.sequelize.query(`
      DROP SEQUENCE IF EXISTS agent_reference_seq
    `);

  }
};