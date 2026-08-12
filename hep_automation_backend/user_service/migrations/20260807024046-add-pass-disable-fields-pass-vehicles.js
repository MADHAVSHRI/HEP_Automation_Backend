"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pass_vehicles", "passStatus", {
      type: Sequelize.ENUM(
        "ACTIVE",
        "DISABLED"
      ),
      allowNull: false,
      defaultValue: "ACTIVE",
    });

    await queryInterface.addColumn("pass_vehicles", "disabledReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("pass_vehicles", "disabledAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("pass_vehicles", "disabledBy", {
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
      "pass_vehicles",
      ["passStatus"],
      {
        name: "idx_pass_vehicles_passStatus",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "pass_vehicles",
      "idx_pass_vehicles_passStatus"
    );

    await queryInterface.removeColumn(
      "pass_vehicles",
      "disabledBy"
    );

    await queryInterface.removeColumn(
      "pass_vehicles",
      "disabledAt"
    );

    await queryInterface.removeColumn(
      "pass_vehicles",
      "disabledReason"
    );

    await queryInterface.removeColumn(
      "pass_vehicles",
      "passStatus"
    );

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_pass_vehicles_passStatus";'
    );
  },
};