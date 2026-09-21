"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("vendor_pass_persons");

    if (!table.concernDepartmentId) {
      await queryInterface.addColumn(
        "vendor_pass_persons",
        "concernDepartmentId",
        {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
      );
    }

    // Helpful for department-based approval lookup.
    await queryInterface.addIndex(
      "vendor_pass_persons",
      ["concernDepartmentId"],
      {
        name: "idx_vendor_pass_persons_concern_department",
      },
    );
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("vendor_pass_persons");

    if (table.concernDepartmentId) {
      await queryInterface.removeIndex(
        "vendor_pass_persons",
        "idx_vendor_pass_persons_concern_department",
      );

      await queryInterface.removeColumn(
        "vendor_pass_persons",
        "concernDepartmentId",
      );
    }
  },
};