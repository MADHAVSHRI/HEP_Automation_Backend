"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "employeeId", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });

    await queryInterface.addIndex("users", ["employeeId"], {
      name: "users_employee_id_unique",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("users", "users_employee_id_unique");
    await queryInterface.removeColumn("users", "employeeId");
  },
};
