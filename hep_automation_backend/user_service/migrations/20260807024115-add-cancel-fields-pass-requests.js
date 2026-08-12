"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pass_requests", "isCancelled", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("pass_requests", "cancelReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("pass_requests", "cancelledAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("pass_requests", "cancelledBy", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Agents",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex(
      "pass_requests",
      ["isCancelled"],
      {
        name: "idx_pass_requests_isCancelled",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "pass_requests",
      "idx_pass_requests_isCancelled"
    );

    await queryInterface.removeColumn(
      "pass_requests",
      "cancelledBy"
    );

    await queryInterface.removeColumn(
      "pass_requests",
      "cancelledAt"
    );

    await queryInterface.removeColumn(
      "pass_requests",
      "cancelReason"
    );

    await queryInterface.removeColumn(
      "pass_requests",
      "isCancelled"
    );
  },
};