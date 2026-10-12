"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // approvedBy: filtered by the approver dashboard's "processed by me" count
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pass_requests_approved_by
        ON pass_requests ("approvedBy");
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_pass_requests_approved_by
        ON vendor_pass_requests ("approvedBy");
    `);
    // essentialWorkflowState + status: drives the essential oil-dock vehicle list
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pass_vehicles_essential_workflow_state
        ON pass_vehicles ("essentialWorkflowState", status);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_pass_requests_approved_by;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_vendor_pass_requests_approved_by;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_pass_vehicles_essential_workflow_state;
    `);
  },
};
