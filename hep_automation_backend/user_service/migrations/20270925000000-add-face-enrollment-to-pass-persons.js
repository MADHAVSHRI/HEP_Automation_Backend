"use strict";

/**
 * Tracks whether an approved person's live photo has been enrolled into the
 * face_verify gallery.
 *
 * "FaceEnrolledAt" is set once face_verify has accepted the photo.
 * "FaceEnrollError" is set when the photo itself is unusable (no face found),
 * so the sync job stops retrying it; transient failures leave both null and
 * are retried on the next run.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pass_persons", "FaceEnrolledAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("pass_persons", "FaceEnrollError", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("pass_persons", "FaceEnrolledAt");
    await queryInterface.removeColumn("pass_persons", "FaceEnrollError");
  },
};
