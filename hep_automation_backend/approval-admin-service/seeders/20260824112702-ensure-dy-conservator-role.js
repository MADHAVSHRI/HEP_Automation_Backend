"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const [rows] = await queryInterface.sequelize.query(`
        SELECT id
        FROM "port_department_roles"
        WHERE LOWER(TRIM("roleName"))
          = LOWER('Dy. Conservator')
        LIMIT 1
      `);

    if (rows.length > 0) {
      await queryInterface.sequelize.query(`
        UPDATE "port_department_roles"
        SET
          "roleCode" = 'DY_CONSERVATOR',
          "isActive" = true,
          "updatedAt" = NOW()
        WHERE id = ${rows[0].id}
      `);

      return;
    }

    await queryInterface.bulkInsert("port_department_roles", [
      {
        roleName: "Dy. Conservator",
        roleCode: "DY_CONSERVATOR",
        description: "Deputy Conservator for Essential Oil Dock workflow",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM "port_department_roles"
      WHERE "roleCode" = 'DY_CONSERVATOR'
        AND LOWER(TRIM("roleName"))
          = LOWER('Dy. Conservator')
    `);
  },
};
