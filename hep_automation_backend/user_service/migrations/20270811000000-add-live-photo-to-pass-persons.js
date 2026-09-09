"use strict";

/**
 * Live photograph captured by the applicant themselves — either through the
 * Capture Photo dialog in the portal, or through the shared link opened on the
 * applicant's own phone when they cannot come to the office.
 *
 * Kept separate from "photoFilePath": that is the photograph the agent uploads,
 * and both are needed. One is the submitted document, the other is evidence
 * that a live person sat in front of a camera for this application.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pass_persons", "LivePhotoPath", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn("pass_persons", "FaceVerified", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("pass_persons", "LivePhotoPath");
    await queryInterface.removeColumn("pass_persons", "FaceVerified");
  },
};
