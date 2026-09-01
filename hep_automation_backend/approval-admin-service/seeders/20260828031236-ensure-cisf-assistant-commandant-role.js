"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT id
      FROM "port_department_roles"
      WHERE LOWER(TRIM("roleName"))
        = LOWER('Cisf.Assistant Commandant')
      LIMIT 1
    `);

    if (rows.length > 0) {
      await queryInterface.sequelize.query(
        `
          UPDATE "port_department_roles"
          SET
            "roleCode" = 'CISF_ASSISTANT_COMMANDANT',
            "isActive" = true,
            "updatedAt" = NOW()
          WHERE id = :id
        `,
        {
          replacements: {
            id: rows[0].id,
          },
        },
      );

      return;
    }

    await queryInterface.bulkInsert("port_department_roles", [
      {
        roleName: "Cisf.Assistant Commandant",
        roleCode: "CISF_ASSISTANT_COMMANDANT",
        description: "Assistant Commandant for Oil dock workflow",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `
        DELETE FROM "port_department_roles"
        WHERE "roleCode" = 'CISF_ASSISTANT_COMMANDANT'
          AND LOWER(TRIM("roleName"))
            = LOWER('Cisf.Assistant Commandant')
      `,
    );
  },
};