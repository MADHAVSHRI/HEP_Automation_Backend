"use strict";

/**
 * Seeds the physical gates. Officer assignments are intentionally NOT seeded
 * here — those are operational data managed per posting. Use the sample INSERT
 * in gate-service/README.md to assign a test officer.
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert("gates", [
      {
        gateCode: "GATE_01",
        gateName: "Gate 0",
        laneName: "Entry Lane A",
        location: "Chennai Port — Main Entry",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        gateCode: "GATE_02",
        gateName: "Gate 2",
        laneName: "Entry Lane B",
        location: "Chennai Port — Container Terminal",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        gateCode: "GATE_03",
        gateName: "Gate 3",
        laneName: "Exit Lane A",
        location: "Chennai Port — Oil Jetty",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("gates", {
      gateCode: ["GATE_01", "GATE_02", "GATE_03"],
    });
  },
};
