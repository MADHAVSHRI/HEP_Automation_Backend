"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Make billNumber, billDate, chapterHeading nullable so existing records are
    // preserved and new API submissions no longer require them.
    await queryInterface.changeColumn("customs_examinations", "billNumber", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn("customs_examinations", "billDate", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.changeColumn("customs_examinations", "chapterHeading", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Note: reversing to NOT NULL may fail if existing rows have NULL values.
    await queryInterface.changeColumn("customs_examinations", "billNumber", {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.changeColumn("customs_examinations", "billDate", {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });

    await queryInterface.changeColumn("customs_examinations", "chapterHeading", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
