"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── tos_eir_records indexes ─────────────────────────────────────────────
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tos_eir_container_number
        ON "tos_eir_records" ("containerNumber");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tos_eir_trailer_number
        ON "tos_eir_records" ("trailerNumber");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tos_eir_terminal
        ON "tos_eir_records" ("terminal");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tos_eir_ingate_terminal
        ON "tos_eir_records" ("inGateDateTime", "terminal");
    `);

    // ── tos_form13 indexes ──────────────────────────────────────────────────
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tos_form13_trailer_number
        ON "tos_form13" ("trailerNumber");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tos_form13_terminal
        ON "tos_form13" ("terminal");
    `);

    // ── tos_form13_containers indexes ───────────────────────────────────────
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tos_form13_containers_container_number
        ON "tos_form13_containers" ("containerNumber");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tos_form13_containers_movement_type
        ON "tos_form13_containers" ("movementType");
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tos_eir_container_number;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tos_eir_trailer_number;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tos_eir_terminal;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tos_eir_ingate_terminal;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tos_form13_trailer_number;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tos_form13_terminal;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tos_form13_containers_container_number;`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tos_form13_containers_movement_type;`);
  },
};
