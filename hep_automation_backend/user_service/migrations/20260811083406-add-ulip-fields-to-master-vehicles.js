'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    // =========================================================
    // MASTER VEHICLES
    // =========================================================

    const masterVehicles =
      await queryInterface.describeTable('master_vehicles');

    if (!masterVehicles.ulip_verified) {
      await queryInterface.addColumn(
        'master_vehicles',
        'ulip_verified',
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }
      );
    }

    if (!masterVehicles.vehicle_status) {
      await queryInterface.addColumn(
        'master_vehicles',
        'vehicle_status',
        {
          type: Sequelize.STRING(20),
          allowNull: true,
        }
      );
    }

    if (!masterVehicles.ulip_verified_at) {
      await queryInterface.addColumn(
        'master_vehicles',
        'ulip_verified_at',
        {
          type: Sequelize.DATE,
          allowNull: true,
        }
      );
    }



    // =========================================================
    // MASTER PERSONS
    // =========================================================

    const masterPersons =
      await queryInterface.describeTable('master_persons');

    if (!masterPersons.ulip_verified) {
      await queryInterface.addColumn(
        'master_persons',
        'ulip_verified',
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }
      );
    }

    if (!masterPersons.person_status) {
      await queryInterface.addColumn(
        'master_persons',
        'person_status',
        {
          type: Sequelize.STRING(20),
          allowNull: true,
        }
      );
    }

    if (!masterPersons.ulip_verified_at) {
      await queryInterface.addColumn(
        'master_persons',
        'ulip_verified_at',
        {
          type: Sequelize.DATE,
          allowNull: true,
        }
      );
    }


    // =========================================================
    // PASS PERSONS
    // =========================================================

    const passPersons =
      await queryInterface.describeTable('pass_persons');

    if (!passPersons.ulip_verified) {
      await queryInterface.addColumn(
        'pass_persons',
        'ulip_verified',
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }
      );
    }

    if (!passPersons.person_status) {
      await queryInterface.addColumn(
        'pass_persons',
        'person_status',
        {
          type: Sequelize.STRING(20),
          allowNull: true,
        }
      );
    }

    if (!passPersons.ulip_verified_at) {
      await queryInterface.addColumn(
        'pass_persons',
        'ulip_verified_at',
        {
          type: Sequelize.DATE,
          allowNull: true,
        }
      );
    }

    // =========================================================
    // PASS VEHICLES
    // =========================================================

    const passVehicles =
      await queryInterface.describeTable('pass_vehicles');

    if (!passVehicles.ulip_verified) {
      await queryInterface.addColumn(
        'pass_vehicles',
        'ulip_verified',
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }
      );
    }

    if (!passVehicles.vehicle_status) {
      await queryInterface.addColumn(
        'pass_vehicles',
        'vehicle_status',
        {
          type: Sequelize.STRING(20),
          allowNull: true,
        }
      );
    }

    if (!passVehicles.ulip_verified_at) {
      await queryInterface.addColumn(
        'pass_vehicles',
        'ulip_verified_at',
        {
          type: Sequelize.DATE,
          allowNull: true,
        }
      );
    }
  },


  async down(queryInterface) {

    // =========================================================
    // MASTER VEHICLES
    // =========================================================

    const masterVehicles =
      await queryInterface.describeTable('master_vehicles');

    if (masterVehicles.ulip_verified_at) {
      await queryInterface.removeColumn(
        'master_vehicles',
        'ulip_verified_at'
      );
    }

    if (masterVehicles.vehicle_status) {
      await queryInterface.removeColumn(
        'master_vehicles',
        'vehicle_status'
      );
    }

    if (masterVehicles.ulip_verified) {
      await queryInterface.removeColumn(
        'master_vehicles',
        'ulip_verified'
      );
    }


    // =========================================================
    // PASS VEHICLES
    // =========================================================

    const passVehicles =
      await queryInterface.describeTable('pass_vehicles');

    if (passVehicles.ulip_verified_at) {
      await queryInterface.removeColumn(
        'pass_vehicles',
        'ulip_verified_at'
      );
    }

    if (passVehicles.vehicle_status) {
      await queryInterface.removeColumn(
        'pass_vehicles',
        'vehicle_status'
      );
    }

    if (passVehicles.ulip_verified) {
      await queryInterface.removeColumn(
        'pass_vehicles',
        'ulip_verified'
      );
    }


    // =========================================================
    // MASTER PERSONS
    // =========================================================

    const masterPersons =
      await queryInterface.describeTable('master_persons');

    if (masterPersons.ulip_verified_at) {
      await queryInterface.removeColumn(
        'master_persons',
        'ulip_verified_at'
      );
    }

    if (masterPersons.person_status) {
      await queryInterface.removeColumn(
        'master_persons',
        'person_status'
      );
    }

    if (masterPersons.ulip_verified) {
      await queryInterface.removeColumn(
        'master_persons',
        'ulip_verified'
      );
    }


    // =========================================================
    // PASS PERSONS
    // =========================================================

    const passPersons =
      await queryInterface.describeTable('pass_persons');

    if (passPersons.ulip_verified_at) {
      await queryInterface.removeColumn(
        'pass_persons',
        'ulip_verified_at'
      );
    }

    if (passPersons.person_status) {
      await queryInterface.removeColumn(
        'pass_persons',
        'person_status'
      );
    }

    if (passPersons.ulip_verified) {
      await queryInterface.removeColumn(
        'pass_persons',
        'ulip_verified'
      );
    }
  },
};