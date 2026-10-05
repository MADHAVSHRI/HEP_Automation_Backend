"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "vendor_material_request_gates",
      {
        id: {
          type: Sequelize.BIGINT,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },

        requestId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: {
            model: "vendor_material_requests",
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

        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },

        addedByUserId: {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },

        addedByActorType: {
          type: Sequelize.STRING(20),
          allowNull: false,
        },

        deactivatedByUserId: {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },

        deactivatedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },

        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal(
            "CURRENT_TIMESTAMP"
          ),
        },

        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal(
            "CURRENT_TIMESTAMP"
          ),
        },
      }
    );

    await queryInterface.sequelize.query(`
      ALTER TABLE "vendor_material_request_gates"
      ADD CONSTRAINT "chk_vendor_material_request_gate_actor"
      CHECK (
        "addedByActorType" IN (
          'VENDOR',
          'DEPARTMENT',
          'CISF',
          'SYSTEM'
        )
      );

      ALTER TABLE "vendor_material_request_gates"
      ADD CONSTRAINT "chk_vendor_material_request_gate_added_by"
      CHECK (
        (
          "addedByActorType" IN (
            'VENDOR',
            'SYSTEM'
          )
          AND "addedByUserId" IS NULL
        )
        OR
        (
          "addedByActorType" IN (
            'DEPARTMENT',
            'CISF'
          )
          AND "addedByUserId" IS NOT NULL
        )
      );

      ALTER TABLE "vendor_material_request_gates"
      ADD CONSTRAINT "chk_vendor_material_request_gate_deactivation"
      CHECK (
        (
          "isActive" = TRUE
          AND "deactivatedAt" IS NULL
          AND "deactivatedByUserId" IS NULL
        )
        OR
        (
          "isActive" = FALSE
          AND "deactivatedAt" IS NOT NULL
        )
      );
    `);

    await queryInterface.addConstraint(
      "vendor_material_request_gates",
      {
        fields: [
          "requestId",
          "gateId",
        ],
        type: "unique",
        name:
          "uq_vendor_material_request_gate",
      }
    );

    await queryInterface.addIndex(
      "vendor_material_request_gates",
      [
        "requestId",
        "isActive",
      ],
      {
        name:
          "idx_vendor_material_request_gates_active",
      }
    );

    await queryInterface.addIndex(
      "vendor_material_request_gates",
      ["gateId"],
      {
        name:
          "idx_vendor_material_request_gates_gate",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(
      "vendor_material_request_gates"
    );
  },
};