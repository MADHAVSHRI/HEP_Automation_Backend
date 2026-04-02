"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.bulkInsert("designations", [
      {
        name: "Addl Asst Director (Safety)",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Assistant Director (Safety)",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      { name: "Cadet", isActive: true, createdAt: now, updatedAt: now },
      { name: "Cashier", isActive: true, createdAt: now, updatedAt: now },
      { name: "CE", isActive: true, createdAt: now, updatedAt: now },
      { name: "Chemist", isActive: true, createdAt: now, updatedAt: now },
      {
        name: "Chief Manager Engineering",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      { name: "Cleaner", isActive: true, createdAt: now, updatedAt: now },
      { name: "Clerk", isActive: true, createdAt: now, updatedAt: now },
      {
        name: "College Student",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      { name: "CT", isActive: true, createdAt: now, updatedAt: now },
      {
        name: "Deputy General Manager",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      { name: "Driver", isActive: true, createdAt: now, updatedAt: now },
      { name: "Employee", isActive: true, createdAt: now, updatedAt: now },
      { name: "Employer", isActive: true, createdAt: now, updatedAt: now },
      { name: "Engineer", isActive: true, createdAt: now, updatedAt: now },
      { name: "Executive-I", isActive: true, createdAt: now, updatedAt: now },
      { name: "Fabricator", isActive: true, createdAt: now, updatedAt: now },
      { name: "Forester", isActive: true, createdAt: now, updatedAt: now },
      {
        name: "General Manager",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Head Technical",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      { name: "Importer", isActive: true, createdAt: now, updatedAt: now },
      {
        name: "Junior Manager",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      { name: "Labour", isActive: true, createdAt: now, updatedAt: now },
      {
        name: "Labour Enforcement Officer",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      { name: "Manager", isActive: true, createdAt: now, updatedAt: now },
      { name: "Owner", isActive: true, createdAt: now, updatedAt: now },
      { name: "Partner", isActive: true, createdAt: now, updatedAt: now },
      {
        name: "Power of Attorney",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      { name: "Sales Manager", isActive: true, createdAt: now, updatedAt: now },
      { name: "Sales Man", isActive: true, createdAt: now, updatedAt: now },
      {
        name: "School Student",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Senior Observer",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      { name: "Serviceman", isActive: true, createdAt: now, updatedAt: now },
      { name: "Staff", isActive: true, createdAt: now, updatedAt: now },
      { name: "Teacher", isActive: true, createdAt: now, updatedAt: now },
      { name: "Visitor", isActive: true, createdAt: now, updatedAt: now },
      { name: "Others", isActive: true, createdAt: now, updatedAt: now },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("designations", null, {});
  },
};
