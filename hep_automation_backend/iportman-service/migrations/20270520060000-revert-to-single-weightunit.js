"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("weighbridge_records", "weightUnit", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      'UPDATE "weighbridge_records" SET "weightUnit" = "grossWeightUnit"',
    );
    await queryInterface.changeColumn("weighbridge_records", "weightUnit", {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.removeColumn("weighbridge_records", "grossWeightUnit");
    await queryInterface.removeColumn("weighbridge_records", "tareWeightUnit");
    await queryInterface.removeColumn("weighbridge_records", "netWeightUnit");
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("weighbridge_records", "grossWeightUnit", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "kg",
    });
    await queryInterface.addColumn("weighbridge_records", "tareWeightUnit", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "kg",
    });
    await queryInterface.addColumn("weighbridge_records", "netWeightUnit", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "kg",
    });
    await queryInterface.sequelize.query(
      'UPDATE "weighbridge_records" SET "grossWeightUnit" = "weightUnit", "tareWeightUnit" = "weightUnit", "netWeightUnit" = "weightUnit"',
    );
    await queryInterface.removeColumn("weighbridge_records", "weightUnit");
  },
};
