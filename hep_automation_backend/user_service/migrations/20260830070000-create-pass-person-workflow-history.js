"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("pass_person_workflow_history", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      passPersonId: {
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
    });

    await queryInterface.addIndex(
      "pass_person_workflow_history",
      ["passPersonId"],
      {
        name: "idx_pass_person_workflow_history_person",
      },
    );

    await queryInterface.addIndex(
      "pass_person_workflow_history",
      ["passRequestId"],
      {
        name: "idx_pass_person_workflow_history_request",
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("pass_person_workflow_history");
  },
};