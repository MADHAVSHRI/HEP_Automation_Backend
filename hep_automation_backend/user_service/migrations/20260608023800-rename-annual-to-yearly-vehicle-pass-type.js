"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_pass_vehicles_passType"
      RENAME VALUE 'ANNUAL' TO 'YEARLY';
    `);

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_pass_vehicles_passType"
      RENAME VALUE 'YEARLY' TO 'ANNUAL';
    `);

  }
};