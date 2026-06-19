"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {

    /*
    =====================================
    ADD TO pass_requests
    =====================================
    */

    await queryInterface.addColumn(
      "pass_requests",
      "requisitionLetterFilePath",
      {
        type: Sequelize.STRING(500),
        allowNull: true,
      }
    );

    await queryInterface.addColumn(
      "pass_requests",
      "requisitionLetterFileName",
      {
        type: Sequelize.STRING(255),
        allowNull: true,
      }
    );

    /*
    =====================================
    REMOVE FROM pass_persons
    =====================================
    */

    const passPersonsColumns = await queryInterface.describeTable(
      "pass_persons"
    );

    if (passPersonsColumns.requisitionLetterPath) {
      await queryInterface.removeColumn(
        "pass_persons",
        "requisitionLetterPath"
      );
    }

    if (passPersonsColumns.requisitionLetterName) {
      await queryInterface.removeColumn(
        "pass_persons",
        "requisitionLetterName"
      );
    }

    /*
    =====================================
    REMOVE FROM master_persons
    =====================================
    */

    const masterPersonsColumns = await queryInterface.describeTable(
      "master_persons"
    );

    if (masterPersonsColumns.requisitionLetterPath) {
      await queryInterface.removeColumn(
        "master_persons",
        "requisitionLetterPath"
      );
    }

    if (masterPersonsColumns.requisitionLetterName) {
      await queryInterface.removeColumn(
        "master_persons",
        "requisitionLetterName"
      );
    }

  },

  async down(queryInterface, Sequelize) {

    /*
    =====================================
    REMOVE FROM pass_requests
    =====================================
    */

    await queryInterface.removeColumn(
      "pass_requests",
      "requisitionLetterFilePath"
    );

    await queryInterface.removeColumn(
      "pass_requests",
      "requisitionLetterFileName"
    );

    /*
    =====================================
    RESTORE pass_persons
    =====================================
    */

    await queryInterface.addColumn(
      "pass_persons",
      "requisitionLetterPath",
      {
        type: Sequelize.STRING(500),
        allowNull: true,
      }
    );

    await queryInterface.addColumn(
      "pass_persons",
      "requisitionLetterName",
      {
        type: Sequelize.STRING(255),
        allowNull: true,
      }
    );

    /*
    =====================================
    RESTORE master_persons
    =====================================
    */

    await queryInterface.addColumn(
      "master_persons",
      "requisitionLetterPath",
      {
        type: Sequelize.STRING(500),
        allowNull: true,
      }
    );

    await queryInterface.addColumn(
      "master_persons",
      "requisitionLetterName",
      {
        type: Sequelize.STRING(255),
        allowNull: true,
      }
    );

  },
};