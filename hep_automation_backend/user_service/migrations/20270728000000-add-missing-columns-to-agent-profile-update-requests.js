"use strict";

/**
 * Migration: add authorizedPersonName and remarks columns to AgentProfileUpdateRequests.
 *
 * These columns exist in the model queries and the create-agent-profile-update-requests
 * migration but were absent from the table because an earlier migration snapshot
 * did not include them.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable("AgentProfileUpdateRequests");

    if (!tableDesc.authorizedPersonName) {
      await queryInterface.addColumn("AgentProfileUpdateRequests", "authorizedPersonName", {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!tableDesc.remarks) {
      await queryInterface.addColumn("AgentProfileUpdateRequests", "remarks", {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable("AgentProfileUpdateRequests");

    if (tableDesc.authorizedPersonName) {
      await queryInterface.removeColumn("AgentProfileUpdateRequests", "authorizedPersonName");
    }
    if (tableDesc.remarks) {
      await queryInterface.removeColumn("AgentProfileUpdateRequests", "remarks");
    }
  },
};
