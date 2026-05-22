"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Change pass_persons dateFrom/dateTo from DATEONLY to DATE (stores time too)
    await queryInterface.changeColumn("pass_persons", "dateFrom", {
      type: Sequelize.DATE,
      allowNull: false,
    });
    await queryInterface.changeColumn("pass_persons", "dateTo", {
      type: Sequelize.DATE,
      allowNull: false,
    });

    // Change pass_vehicles dateFrom/dateTo from DATEONLY to DATE
    await queryInterface.changeColumn("pass_vehicles", "dateFrom", {
      type: Sequelize.DATE,
      allowNull: false,
    });
    await queryInterface.changeColumn("pass_vehicles", "dateTo", {
      type: Sequelize.DATE,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert pass_persons
    await queryInterface.changeColumn("pass_persons", "dateFrom", {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });
    await queryInterface.changeColumn("pass_persons", "dateTo", {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });

    // Revert pass_vehicles
    await queryInterface.changeColumn("pass_vehicles", "dateFrom", {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });
    await queryInterface.changeColumn("pass_vehicles", "dateTo", {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });
  },
};
