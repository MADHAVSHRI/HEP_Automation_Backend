"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert("port_departments", [
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
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("port_departments", null, {});
  },
};
