"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "vendor_material_link_gates",
      {
        id: {
          type: Sequelize.BIGINT,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },

        vendorMaterialLinkId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: {
            model: "vendor_material_links",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },

        gateId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: {
            model: "gates",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },

        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },

        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      }
    );

    await queryInterface.addConstraint(
      "vendor_material_link_gates",
      {
        fields: ["vendorMaterialLinkId", "gateId"],
        type: "unique",
        name: "uq_vendor_material_link_gate",
      }
    );

    await queryInterface.addIndex(
      "vendor_material_link_gates",
      ["gateId"],
      {
        name: "idx_vendor_material_link_gates_gate",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(
      "vendor_material_link_gates"
    );
  },
};