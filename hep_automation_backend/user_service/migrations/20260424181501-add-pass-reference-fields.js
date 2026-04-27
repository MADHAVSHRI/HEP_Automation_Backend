"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    /*
    ==========================================
    Add person pass number
    ==========================================
    */

    await queryInterface.addColumn("pass_persons", "personPassNo", {
      type: Sequelize.STRING(30),
      unique: true,
    });

    /*
    ==========================================
    Add vehicle pass number
    ==========================================
    */

    await queryInterface.addColumn("pass_vehicles", "vehiclePassNo", {
      type: Sequelize.STRING(30),
      unique: true,
    });

    /*
    ==========================================
    Create index for pass request reference
    ==========================================
    */

    await queryInterface.addIndex("pass_requests", ["referenceNo"], {
      unique: true,
      name: "idx_pass_reference",
    });

    /*
    ==========================================
    Create index for person pass number
    ==========================================
    */

    await queryInterface.addIndex("pass_persons", ["personPassNo"], {
      unique: true,
      name: "idx_person_pass_no",
    });

    /*
    ==========================================
    Create index for vehicle pass number
    ==========================================
    */

    await queryInterface.addIndex("pass_vehicles", ["vehiclePassNo"], {
      unique: true,
      name: "idx_vehicle_pass_no",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("pass_requests", "idx_pass_reference");

    await queryInterface.removeIndex("pass_persons", "idx_person_pass_no");

    await queryInterface.removeIndex("pass_vehicles", "idx_vehicle_pass_no");

    await queryInterface.removeColumn("pass_persons", "personPassNo");

    await queryInterface.removeColumn("pass_vehicles", "vehiclePassNo");
  },
};
