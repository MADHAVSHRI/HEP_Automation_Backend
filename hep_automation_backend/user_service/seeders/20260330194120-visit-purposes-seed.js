"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert("visit_purposes", [
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
    ]);
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
