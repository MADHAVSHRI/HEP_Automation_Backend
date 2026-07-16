"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert("port_department_roles", [
      {
        roleName: "Safety Officer",
        roleCode: "SAFETY_OFFICER",
        description: "Safety department pre-approval of Twist Lock and Fitness certificates",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        roleName: "Fire Safety Officer",
        roleCode: "FIRE_SAFETY_OFFICER",
        description: "Fire safety department pre-approval of Spark Arrester certificates",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        roleName: "Senior Deputy Traffic Manager",
        roleCode: "SR_DTM",
        description: "Senior Deputy Traffic Manager restricted-area entry authorization",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("port_department_roles", {
      roleCode: ["SAFETY_OFFICER", "FIRE_SAFETY_OFFICER", "SR_DTM"],
    });
  },
};
