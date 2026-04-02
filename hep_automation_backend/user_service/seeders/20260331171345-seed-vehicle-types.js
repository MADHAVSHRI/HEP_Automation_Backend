"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    const vehicleTypes = [
      "ARTICULATED",
      "BACK-HOES",
      "BUS",
      "CAR",
      "CEMENT MIXER",
      "CONCRETE MIXER LORRY",
      "CRANE",
      "CYCLE RICKSHAW",
      "DEFENCE TANK",
      "DOZERS",
      "DUMPERS",
      "EXCAVATORS",
      "FORKLIFT",
      "FOUR WHEELER",
      "INDIVIDUAL ONLY",
      "JCB EARTHMOVER",
      "JEEP",
      "LIGHT VEHICLE",
      "LORRY",
      "MOBILE CRANE",
      "OPEN LORRY",
      "OPEN TRACTOR",
      "OPEN TRUCK",
      "PAY LOADER",
      "PFS VEHICLE",
      "POCLAIN",
      "RECOVERY",
      "ROADROLLER",
      "TANKER",
      "TARUS",
      "TAURUS TIPPER",
      "TAXI",
      "TRACTOR TRAILER",
      "TRAILER LORRY",
      "TRAILORS",
      "TRI CYCLE",
      "TRUCKS",
      "TIPPER",
      "VAN",
    ];

    const data = vehicleTypes.map((name) => ({
      name,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await queryInterface.bulkInsert("vehicle_types", data);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("vehicle_types", null, {});
  },
};
