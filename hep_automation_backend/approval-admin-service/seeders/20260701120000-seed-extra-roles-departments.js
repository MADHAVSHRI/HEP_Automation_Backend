"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // ── Roles ──────────────────────────────────────────────────────────────
    const NEW_ROLES = [
      "SS",
      "SM",
      "ASM",
      "Safety Officer",
      "Gate Operator",
    ];

    const existingRoles = await queryInterface.sequelize.query(
      `
        SELECT "roleName"
        FROM "port_department_roles"
        WHERE "roleName" IN (:names)
      `,
      {
        replacements: { names: NEW_ROLES },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    const existingRoleNames = new Set(
      existingRoles.map((r) => r.roleName)
    );

    const rolesToInsert = NEW_ROLES
      .filter((roleName) => !existingRoleNames.has(roleName))
      .map((roleName) => ({
        roleName,
        createdAt: now,
        updatedAt: now,
      }));

    if (rolesToInsert.length > 0) {
      await queryInterface.bulkInsert(
        "port_department_roles",
        rolesToInsert
      );

      console.log(
        "[seeder] Inserted roles:",
        rolesToInsert.map((r) => r.roleName)
      );
    } else {
      console.log(
        "[seeder] All target roles already exist — skipped."
      );
    }

    // ── Departments ───────────────────────────────────────────────────────
    const NEW_DEPTS = ["Safety", "Gate"];

    const existingDepts = await queryInterface.sequelize.query(
      `
        SELECT "departmentName"
        FROM "port_departments"
        WHERE "departmentName" IN (:names)
      `,
      {
        replacements: { names: NEW_DEPTS },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    const existingDeptNames = new Set(
      existingDepts.map((d) => d.departmentName)
    );

    const deptsToInsert = NEW_DEPTS
      .filter((departmentName) => !existingDeptNames.has(departmentName))
      .map((departmentName) => ({
        departmentName,
        createdAt: now,
        updatedAt: now,
      }));

    if (deptsToInsert.length > 0) {
      await queryInterface.bulkInsert(
        "port_departments",
        deptsToInsert
      );

      console.log(
        "[seeder] Inserted departments:",
        deptsToInsert.map((d) => d.departmentName)
      );
    } else {
      console.log(
        "[seeder] All target departments already exist — skipped."
      );
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove only records that this seeder was intended to add.
    // Safety Officer is intentionally preserved because it may have
    // existed before this seeder ran.

    await queryInterface.bulkDelete("port_department_roles", {
      roleName: {
        [Sequelize.Op.in]: [
          "SS",
          "SM",
          "ASM",
          "Gate Operator",
        ],
      },
    });

    await queryInterface.bulkDelete("port_departments", {
      departmentName: {
        [Sequelize.Op.in]: [
          "Safety",
          "Gate",
        ],
      },
    });

    console.log(
      "[seeder:down] Removed seeded roles and departments."
    );
  },
};