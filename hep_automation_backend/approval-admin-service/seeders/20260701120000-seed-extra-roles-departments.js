"use strict";

/**
 * Idempotent seeder — adds roles and departments that may be missing.
 * Safe to re-run: SELECTs first, inserts only missing rows.
 *
 * Roles added: SS, SM, ASM (Shipping Control blacklist creators),
 *              Safety Officer, Gate Operator
 * Departments added: Safety, Gate
 * (CISF, Finance, Weigh Bridge already exist in the original seeder.)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // ── Roles ──────────────────────────────────────────────────────────────
    const NEW_ROLES = ["SS", "SM", "ASM", "Safety Officer", "Gate Operator"];

    const [existingRoles] = await queryInterface.sequelize.query(
      `SELECT "roleName" FROM "port_department_roles" WHERE "roleName" = ANY(:names)`,
      { replacements: { names: NEW_ROLES }, type: Sequelize.QueryTypes.SELECT }
    );

    // existingRoles is the first row if only one is returned; handle both array and object
    const existingRoleSet = new Set(
      Array.isArray(existingRoles)
        ? existingRoles.map((r) => r.roleName)
        : existingRoles
        ? [existingRoles.roleName]
        : []
    );

    const [allExistingRoles] = await queryInterface.sequelize.query(
      `SELECT "roleName" FROM "port_department_roles" WHERE "roleName" = ANY(:names)`,
      { replacements: { names: NEW_ROLES } }
    );

    const existingRoleNames = new Set(
      (allExistingRoles || []).map((r) => r.roleName)
    );

    const rolesToInsert = NEW_ROLES.filter((r) => !existingRoleNames.has(r)).map(
      (roleName) => ({ roleName, createdAt: now, updatedAt: now })
    );

    if (rolesToInsert.length > 0) {
      await queryInterface.bulkInsert("port_department_roles", rolesToInsert);
      console.log("[seeder] Inserted roles:", rolesToInsert.map((r) => r.roleName));
    } else {
      console.log("[seeder] All target roles already exist — skipped.");
    }

    // ── Departments ─────────────────────────────────────────────────────────
    const NEW_DEPTS = ["Safety", "Gate"];

    const [allExistingDepts] = await queryInterface.sequelize.query(
      `SELECT "departmentName" FROM "port_departments" WHERE "departmentName" = ANY(:names)`,
      { replacements: { names: NEW_DEPTS } }
    );

    const existingDeptNames = new Set(
      (allExistingDepts || []).map((d) => d.departmentName)
    );

    const deptsToInsert = NEW_DEPTS.filter((d) => !existingDeptNames.has(d)).map(
      (departmentName) => ({ departmentName, createdAt: now, updatedAt: now })
    );

    if (deptsToInsert.length > 0) {
      await queryInterface.bulkInsert("port_departments", deptsToInsert);
      console.log("[seeder] Inserted departments:", deptsToInsert.map((d) => d.departmentName));
    } else {
      console.log("[seeder] All target departments already exist — skipped.");
    }
  },

  async down(queryInterface, Sequelize) {
    // Intentionally minimal — do not delete roles/depts that may be in use
    console.log("[seeder:down] No destructive rollback implemented for safety.");
  },
};
