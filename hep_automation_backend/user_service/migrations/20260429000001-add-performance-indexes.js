"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── Agents table ──────────────────────────────────────────────────────────
    // loginId: queried on every agent login
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_login_id
        ON "Agents" ("loginId");
    `);

    // referenceNumber: queried on every track request and document view
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_reference_number
        ON "Agents" ("referenceNumber");
    `);

    // email, mobileNo, panNumber, gstinNumber: queried together on duplicate check
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_email
        ON "Agents" (email);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_mobile_no
        ON "Agents" ("mobileNo");
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_pan_number
        ON "Agents" ("panNumber");
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_gstin_number
        ON "Agents" ("gstinNumber");
    `);

    // status: used in approval admin queries
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_status
        ON "Agents" (status);
    `);

    // ── pass_requests table ───────────────────────────────────────────────────
    // agentId: queried on every dashboard load
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pass_requests_agent_id
        ON pass_requests ("agentId");
    `);

    // status + isActive: used in approval admin filtering
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pass_requests_status_active
        ON pass_requests (status, "isActive");
    `);

    // ── pass_persons table ────────────────────────────────────────────────────
    // passRequestId: queried in every pass detail fetch and aggregation
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pass_persons_pass_request_id
        ON pass_persons ("passRequestId");
    `);

    // status: used in pending-check and approval queries
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pass_persons_status
        ON pass_persons (status);
    `);

    // ── pass_vehicles table ───────────────────────────────────────────────────
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pass_vehicles_pass_request_id
        ON pass_vehicles ("passRequestId");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pass_vehicles_status
        ON pass_vehicles (status);
    `);
  },

  async down(queryInterface, Sequelize) {
    const indexes = [
      "idx_agents_login_id",
      "idx_agents_reference_number",
      "idx_agents_email",
      "idx_agents_mobile_no",
      "idx_agents_pan_number",
      "idx_agents_gstin_number",
      "idx_agents_status",
      "idx_pass_requests_agent_id",
      "idx_pass_requests_status_active",
      "idx_pass_persons_pass_request_id",
      "idx_pass_persons_status",
      "idx_pass_vehicles_pass_request_id",
      "idx_pass_vehicles_status",
    ];

    for (const idx of indexes) {
      await queryInterface.sequelize.query(
        `DROP INDEX CONCURRENTLY IF EXISTS ${idx};`
      );
    }
  },
};
