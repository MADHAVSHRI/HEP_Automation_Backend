"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("gate_officer_assignments", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      gateId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "gates",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      // approval-admin-service `users` table (port department users). The CISF
      // officer is an existing user; no separate officer table is introduced.
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addConstraint("gate_officer_assignments", {
      fields: ["gateId", "userId"],
      type: "unique",
      name: "gate_officer_assignments_gate_user_unique",
    });

    await queryInterface.addIndex("gate_officer_assignments", ["userId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("gate_officer_assignments");
  },
};
