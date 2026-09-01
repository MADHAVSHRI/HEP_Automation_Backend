"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("pass_vehicle_workflow_history", {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      passVehicleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      passRequestId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      stage: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },

      action: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },

      actorUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      actorRoleId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      actorDepartmentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
    await queryInterface.addIndex("pass_vehicle_workflow_history", [
      "passVehicleId",
      "createdAt",
    ]);

    await queryInterface.addIndex("pass_vehicle_workflow_history", [
      "actorUserId",
      "stage",
    ]);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
