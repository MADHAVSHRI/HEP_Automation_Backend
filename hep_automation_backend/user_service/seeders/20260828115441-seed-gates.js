"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const gates = Array.from(
      { length: 11 },
      (_, gateNumber) => ({
        gateName: `Gate ${gateNumber}`,
        gateCode: `GATE_${gateNumber}`,
        description: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
    );

    await queryInterface.bulkInsert("gates", gates);
  },

  async down(queryInterface) {
    const gateCodes = Array.from(
      { length: 11 },
      (_, gateNumber) => `GATE_${gateNumber}`
    );

    await queryInterface.bulkDelete("gates", {
      gateCode: gateCodes,
    });
  },
};