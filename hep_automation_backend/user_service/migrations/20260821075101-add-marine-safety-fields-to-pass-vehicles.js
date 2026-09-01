"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pass_vehicles", "marineSafetyApproved", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("pass_vehicles", "marineSafetyRemarks", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("pass_vehicles", "marineSafetyApprovedBy", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn("pass_vehicles", "marineSafetyApprovedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "pass_vehicles",
      "marineSafetyApprovedAt",
    );

    await queryInterface.removeColumn(
      "pass_vehicles",
      "marineSafetyApprovedBy",
    );

    await queryInterface.removeColumn(
      "pass_vehicles",
      "marineSafetyRemarks",
    );

    await queryInterface.removeColumn(
      "pass_vehicles",
      "marineSafetyApproved",
    );
  },
};