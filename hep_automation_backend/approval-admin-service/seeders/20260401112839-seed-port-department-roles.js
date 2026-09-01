"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const allRoles = [
      { roleName: "Admin", createdAt: now, updatedAt: now },
      { roleName: "Administrator", createdAt: now, updatedAt: now },
      { roleName: "Agent", createdAt: now, updatedAt: now },
      { roleName: "Approval", createdAt: now, updatedAt: now },
      { roleName: "ATM", createdAt: now, updatedAt: now },
      { roleName: "Card Admin", createdAt: now, updatedAt: now },
      { roleName: "Card Issue", createdAt: now, updatedAt: now },
      { roleName: "Card Issuer", createdAt: now, updatedAt: now },
      { roleName: "CISF", createdAt: now, updatedAt: now },
      { roleName: "Clerk", createdAt: now, updatedAt: now },
      { roleName: "Commandant", createdAt: now, updatedAt: now },
      { roleName: "Coastal", createdAt: now, updatedAt: now },
      { roleName: "Data Entry Operator", createdAt: now, updatedAt: now },
      { roleName: "Department", createdAt: now, updatedAt: now },
      { roleName: "Developer", createdAt: now, updatedAt: now },
      { roleName: "FA Approval", createdAt: now, updatedAt: now },
      { roleName: "Finance", createdAt: now, updatedAt: now },
      { roleName: "HOD", createdAt: now, updatedAt: now },
      { roleName: "Pass Admin", createdAt: now, updatedAt: now },
      { roleName: "Report", createdAt: now, updatedAt: now },
      { roleName: "Sub Admin", createdAt: now, updatedAt: now },
      { roleName: "Supervisor", createdAt: now, updatedAt: now },
      { roleName: "Transporter", createdAt: now, updatedAt: now },
      { roleName: "Vendor Pass", createdAt: now, updatedAt: now },
      { roleName: "Weigh Bridge", createdAt: now, updatedAt: now },
    ];

    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT "roleName" FROM port_department_roles WHERE "roleName" IN (:names)`,
      {
        replacements: { names: allRoles.map((r) => r.roleName) },
      },
    );

    const existingNames = new Set((existingRows || []).map((r) => r.roleName));
    const newRecords = allRoles.filter((r) => !existingNames.has(r.roleName));

    if (newRecords.length > 0) {
      await queryInterface.bulkInsert("port_department_roles", newRecords);
    }
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  },
};
