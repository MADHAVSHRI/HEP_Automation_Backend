"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const allPurposes = [
      {
        name: "Inspection",
        description: "Inspection related visit",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Maintenance",
        description: "Maintenance related visit",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Repairs",
        description: "Repair work visit",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Site Visit",
        description: "Site visit for evaluation",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "New Project",
        description: "Visit related to new project",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Others",
        description: "Other purpose",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Fetch existing purpose names to skip already existing entries
    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT name FROM visit_purposes WHERE name IN (:names)`,
      {
        replacements: { names: allPurposes.map((p) => p.name) },
      }
    );

    const existingNames = new Set((existingRows || []).map((r) => r.name));
    const newRecords = allPurposes.filter((p) => !existingNames.has(p.name));

    if (newRecords.length > 0) {
      await queryInterface.bulkInsert("visit_purposes", newRecords);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("visit_purposes", {
      name: [
        "Inspection",
        "Maintenance",
        "Repairs",
        "Site Visit",
        "New Project",
        "Others",
      ],
    });
  },
};
