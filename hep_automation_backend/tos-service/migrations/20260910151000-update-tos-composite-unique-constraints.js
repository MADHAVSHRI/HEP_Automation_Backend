"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Remove standalone unique constraint on eirNo in tos_eir_records if exists
    try {
      await queryInterface.removeConstraint("tos_eir_records", "tos_eir_records_eirNo_key");
    } catch (_) {}

    try {
      await queryInterface.removeConstraint("tos_eir_records", "tos_eir_records_eirNo_unique");
    } catch (_) {}

    // 2. Add composite unique index on (eirNo, containerNumber)
    try {
      await queryInterface.addIndex("tos_eir_records", ["eirNo", "containerNumber"], {
        unique: true,
        name: "idx_tos_eir_records_eirno_containerno_unique",
      });
    } catch (_) {}

    // 3. Add composite unique index on (form13Id, containerNumber, movementType)
    try {
      await queryInterface.addIndex(
        "tos_form13_containers",
        ["form13Id", "containerNumber", "movementType"],
        {
          unique: true,
          name: "idx_tos_form13_containers_unique",
        },
      );
    } catch (_) {}
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex(
        "tos_form13_containers",
        "idx_tos_form13_containers_unique",
      );
    } catch (_) {}

    try {
      await queryInterface.removeIndex(
        "tos_eir_records",
        "idx_tos_eir_records_eirno_containerno_unique",
      );
    } catch (_) {}

    try {
      await queryInterface.addConstraint("tos_eir_records", {
        fields: ["eirNo"],
        type: "unique",
        name: "tos_eir_records_eirNo_key",
      });
    } catch (_) {}
  },
};
