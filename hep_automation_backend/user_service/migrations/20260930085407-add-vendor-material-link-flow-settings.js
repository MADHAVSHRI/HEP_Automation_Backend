"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(
      async (transaction) => {
        await queryInterface.addColumn(
          "vendor_material_links",
          "gateSelectionMode",
          {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: "DEPARTMENT",
          },
          { transaction }
        );

        await queryInterface.addColumn(
          "vendor_material_links",
          "requiresTrafficApproval",
          {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          },
          { transaction }
        );

        /*
         * Existing links containing gates remain department-controlled.
         *
         * Existing links without gates become vendor-selectable.
         * Previously, those gates could be assigned later by the
         * department. Review that behavior change before deploying.
         */
        await queryInterface.sequelize.query(
          `
            UPDATE vendor_material_links AS link
            SET "gateSelectionMode" = 'VENDOR'
            WHERE NOT EXISTS (
              SELECT 1
              FROM vendor_material_link_gates AS link_gate
              WHERE link_gate."vendorMaterialLinkId" = link.id
            )
          `,
          { transaction }
        );

        await queryInterface.sequelize.query(
          `
            ALTER TABLE vendor_material_links
            ADD CONSTRAINT chk_vendor_material_link_gate_mode
            CHECK (
              "gateSelectionMode" IN (
                'DEPARTMENT',
                'VENDOR'
              )
            )
          `,
          { transaction }
        );
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(
      async (transaction) => {
        await queryInterface.removeConstraint(
          "vendor_material_links",
          "chk_vendor_material_link_gate_mode",
          { transaction }
        );

        await queryInterface.removeColumn(
          "vendor_material_links",
          "requiresTrafficApproval",
          { transaction }
        );

        await queryInterface.removeColumn(
          "vendor_material_links",
          "gateSelectionMode",
          { transaction }
        );
      }
    );
  },
};