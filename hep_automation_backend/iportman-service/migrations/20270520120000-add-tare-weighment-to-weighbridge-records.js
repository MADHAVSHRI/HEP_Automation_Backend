"use strict";

// Date and time of the tare (empty-vehicle) weighment. Nullable so existing
// records stay valid.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("weighbridge_records", "tareWeighmentDate", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn("weighbridge_records", "tareWeighmentTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("weighbridge_records", "tareWeighmentTime");
    await queryInterface.removeColumn("weighbridge_records", "tareWeighmentDate");
  },
};
