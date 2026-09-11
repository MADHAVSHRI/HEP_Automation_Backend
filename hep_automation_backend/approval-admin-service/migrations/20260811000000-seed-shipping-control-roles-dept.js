"use strict";

/**
 * Migration: Add Shipping Control department + SS / SM / ASM roles
 *
 * Context (2026-08-11):
 *   Blacklist CREATION authority moved from "Traffic Manager" to three new
 *   Shipping Control roles:
 *     SS  - Superintendent, Shipping Control
 *     SM  - Shed Master, Shipping Control
 *     ASM - Assistant Shed Master, Area
 *
 *   ATM still owns approve-blacklist / reject-blacklist.
 *   Safe to run multiple times (ON CONFLICT / ignoreDuplicates).
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // 1. Department: Shipping Control
    await queryInterface.sequelize.query(`
      INSERT INTO port_departments ("departmentName", "isActive", "createdAt", "updatedAt")
      VALUES ('Shipping Control', true, NOW(), NOW())
      ON CONFLICT ("departmentName") DO NOTHING;
    `);

    // 2. Roles: SS, SM, ASM
    await queryInterface.bulkInsert(
      "port_department_roles",
      [
        {
          roleName: "SS",
          roleCode: "SS",
          description: "Superintendent - Shipping Control. Can create blacklist entries (pending ATM approval).",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          roleName: "SM",
          roleCode: "SM",
          description: "Shed Master - Shipping Control. Can create blacklist entries (pending ATM approval).",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          roleName: "ASM",
          roleCode: "ASM",
          description: "Assistant Shed Master - Area. Can create blacklist entries (pending ATM approval).",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("port_department_roles", {
      roleCode: ["SS", "SM", "ASM"],
    });
    await queryInterface.sequelize.query(`
      DELETE FROM port_departments WHERE "departmentName" = 'Shipping Control';
    `);
  },
};
