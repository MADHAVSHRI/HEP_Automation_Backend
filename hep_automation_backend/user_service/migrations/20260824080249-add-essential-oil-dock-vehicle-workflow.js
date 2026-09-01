"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pass_vehicles", "essentialDepartmentId", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn("pass_vehicles", "essentialWorkflowState", {
      type: Sequelize.STRING(60),
      allowNull: true,
    });

    await queryInterface.addColumn("pass_vehicles", "essentialRevertStage", {
      type: Sequelize.STRING(60),
      allowNull: true,
    });
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
