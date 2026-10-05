"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("material_list", "description", {
      type: Sequelize.STRING(250),
      allowNull: true,
    });

    await queryInterface.addColumn("material_list", "approvedQty", {
      type: Sequelize.INTEGER,
      allowNull: true, // NULL = not yet reviewed; distinct from an explicit 0 (rejected)
    });

    await queryInterface.addColumn("material_list", "approverRemarks", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("material_list", "cisfRemarks", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // approvedQty must stay within [0, requestedQty] once it's set
    await queryInterface.sequelize.query(`
      ALTER TABLE material_list
      ADD CONSTRAINT material_list_approved_qty_check
      CHECK ("approvedQty" IS NULL OR ("approvedQty" >= 0 AND "approvedQty" <= "requestedQty"));
    `);

    // Replace the old qty check: cap actualMovedQty by approvedQty once approved,
    // otherwise fall back to the original requestedQty cap.
    await queryInterface.sequelize.query(`
      ALTER TABLE material_list DROP CONSTRAINT IF EXISTS material_list_qty_check;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE material_list
      ADD CONSTRAINT material_list_qty_check
      CHECK (
        "requestedQty" >= 0
        AND "actualMovedQty" >= 0
        AND "actualMovedQty" <= COALESCE("approvedQty", "requestedQty")
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE material_list DROP CONSTRAINT IF EXISTS material_list_qty_check;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE material_list
      ADD CONSTRAINT material_list_qty_check
      CHECK ("requestedQty" >= 0 AND "actualMovedQty" >= 0 AND "actualMovedQty" <= "requestedQty");
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE material_list DROP CONSTRAINT IF EXISTS material_list_approved_qty_check;
    `);

    await queryInterface.removeColumn("material_list", "cisfRemarks");
    await queryInterface.removeColumn("material_list", "approverRemarks");
    await queryInterface.removeColumn("material_list", "approvedQty");
    await queryInterface.removeColumn("material_list", "description");
  },
};