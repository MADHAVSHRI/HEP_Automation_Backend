"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "pass_persons",
      "masterPersonId",
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "master_persons",
          key: "id",
        },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      }
    );

    await queryInterface.addIndex(
      "pass_persons",
      ["masterPersonId"],
      {
        name: "idx_pass_persons_masterPersonId",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "pass_persons",
      "idx_pass_persons_masterPersonId"
    );

    await queryInterface.removeColumn(
      "pass_persons",
      "masterPersonId"
    );
  },
};