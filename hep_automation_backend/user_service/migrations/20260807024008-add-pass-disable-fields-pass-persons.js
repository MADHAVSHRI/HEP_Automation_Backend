"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pass_persons", "passStatus", {
      type: Sequelize.ENUM(
        "ACTIVE",
        "DISABLED"
      ),
      allowNull: false,
      defaultValue: "ACTIVE",
    });

    await queryInterface.addColumn("pass_persons", "disabledReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("pass_persons", "disabledAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("pass_persons", "disabledBy", {
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
      "pass_persons",
      ["passStatus"],
      {
        name: "idx_pass_persons_passStatus",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "pass_persons",
      "idx_pass_persons_passStatus"
    );

    await queryInterface.removeColumn(
      "pass_persons",
      "disabledBy"
    );

    await queryInterface.removeColumn(
      "pass_persons",
      "disabledAt"
    );

    await queryInterface.removeColumn(
      "pass_persons",
      "disabledReason"
    );

    await queryInterface.removeColumn(
      "pass_persons",
      "passStatus"
    );

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_pass_persons_passStatus";'
    );
  },
};