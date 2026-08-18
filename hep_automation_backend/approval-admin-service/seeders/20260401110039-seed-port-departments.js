"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    const allDepts = [
      {
        departmentName: "CISF",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "EDP",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Engineering Civil",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Engineering Mechanical",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Finance",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "General Administration",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Marine",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Medical",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Traffic",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Traffic B-Section",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Traffic Commercial",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Traffic L&B",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Traffic Marketing",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Traffic Operation",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Traffic Railway",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Vendor Pass",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        departmentName: "Vigilance",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT "departmentName" FROM port_departments WHERE "departmentName" IN (:names)`,
      {
        replacements: { names: allDepts.map((d) => d.departmentName) },
      }
    );

    const existingNames = new Set((existingRows || []).map((r) => r.departmentName));
    const newRecords = allDepts.filter((d) => !existingNames.has(d.departmentName));

    if (newRecords.length > 0) {
      await queryInterface.bulkInsert("port_departments", newRecords);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("port_departments", null, {});
  },
};
