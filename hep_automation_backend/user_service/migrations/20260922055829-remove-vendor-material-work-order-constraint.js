"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeConstraint(
      "vendor_material_links",
      "chk_vendor_material_links_work_order"
    );
  },

  async down(
    queryInterface
  ) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "vendor_material_links"
      ADD CONSTRAINT "chk_vendor_material_links_work_order"
      CHECK (
        "hasWorkOrder" = FALSE
        OR (
          "referenceDocumentNo" IS NOT NULL
          AND LENGTH(TRIM("referenceDocumentNo")) > 0
        )
      );
    `);
  },
};