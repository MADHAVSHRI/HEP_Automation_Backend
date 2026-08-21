"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove foreign key constraint bulk_pass_batches_parent_request_id_fkey from bulk_pass_batches
    // to allow parent_request_id to be used polymorphically for both public parent requests
    // (bulk_pass_parent_requests) and department parent batches (bulk_pass_batches).
    try {
      await queryInterface.removeConstraint(
        "bulk_pass_batches",
        "bulk_pass_batches_parent_request_id_fkey"
      );
    } catch (err) {
      console.log("Constraint bulk_pass_batches_parent_request_id_fkey already dropped or not present:", err.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // No-op
  },
};
