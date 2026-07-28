"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("vvip_pass_vehicles", "rcBookPath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn("vvip_pass_vehicles", "insuranceDocumentPath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("vvip_pass_vehicles", "insuranceDocumentPath");
    await queryInterface.removeColumn("vvip_pass_vehicles", "rcBookPath");
  },
};
