"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {

    // Remove unique constraint from pass_persons.aadharNo
    try {
      await queryInterface.removeConstraint(
        "pass_persons",
        "pass_persons_aadharNo_key"
      );
    } catch (err) {
      console.warn("Could not remove pass_persons_aadharNo_key:", err.message);
    }

    // Remove unique constraint from pass_vehicles.registrationNo
    try {
      await queryInterface.removeConstraint(
        "pass_vehicles",
        "pass_vehicles_registrationNo_key"
      );
    } catch (err) {
      console.warn("Could not remove pass_vehicles_registrationNo_key:", err.message);
    }

  },

  async down(queryInterface, Sequelize) {

    // Add unique constraint back to pass_persons.aadharNo
    await queryInterface.addConstraint(
      "pass_persons",
      {
        fields: ["aadharNo"],
        type: "unique",
        name: "pass_persons_aadharNo_key"
      }
    );

    // Add unique constraint back to pass_vehicles.registrationNo
    await queryInterface.addConstraint(
      "pass_vehicles",
      {
        fields: ["registrationNo"],
        type: "unique",
        name: "pass_vehicles_registrationNo_key"
      }
    );

  }
};