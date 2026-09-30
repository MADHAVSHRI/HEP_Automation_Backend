"use strict";

/**
 * Migration: Add Traffic Manager role
 *
 * Context (2026-09-03):
 *   Adds the "Traffic Manager" role to port_department_roles so that
 *   users assigned this role can log in to the dedicated Traffic Manager
 *   dashboard (/traffic_manager) with its own separate login portal.
 *
 *   roleCode: TM
 *   This role gets access to the pass_section-style dashboard showing
 *   pass approvals, blacklist stats, overstay charges, etc.
 *
 *   Safe to run multiple times (ignoreDuplicates).
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // Add Traffic Manager role
    await queryInterface.bulkInsert(
      "port_department_roles",
      [
        {
          roleName: "Traffic Manager",
          roleCode: "TM",
          description:
            "Traffic Manager. Has access to the Traffic Manager dashboard for pass approvals, blacklist stats, and overstay charge monitoring.",
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
      roleCode: ["TM"],
    });
  },
};
