"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "pass_persons",
      "essentialDepartmentId",
      {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
    );

    await queryInterface.addColumn(
      "pass_persons",
      "essentialWorkflowState",
      {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
    );

    await queryInterface.addColumn(
      "pass_persons",
      "essentialRevertStage",
      {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
    );

    await queryInterface.addColumn(
      "pass_persons",
      "essentialAssignedUserId",
      {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "pass_persons",
      "essentialAssignedUserId",
    );

    await queryInterface.removeColumn(
      "pass_persons",
      "essentialRevertStage",
    );

    await queryInterface.removeColumn(
      "pass_persons",
      "essentialWorkflowState",
    );

    await queryInterface.removeColumn(
      "pass_persons",
      "essentialDepartmentId",
    );
  },
};