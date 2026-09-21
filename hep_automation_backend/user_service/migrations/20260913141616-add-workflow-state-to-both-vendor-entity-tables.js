"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const vendorPassPersonsTable = await queryInterface.describeTable(
      "vendor_pass_persons",
    );

    const vendorPassVehiclesTable = await queryInterface.describeTable(
      "vendor_pass_vehicles",
    );

    if (!vendorPassPersonsTable.workflowState) {
      await queryInterface.addColumn(
        "vendor_pass_persons",
        "workflowState",
        {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
      );
    }

    if (!vendorPassPersonsTable.workflowActionStage) {
      await queryInterface.addColumn(
        "vendor_pass_persons",
        "workflowActionStage",
        {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
      );
    }

    if (!vendorPassPersonsTable.workflowActionRemarks) {
      await queryInterface.addColumn(
        "vendor_pass_persons",
        "workflowActionRemarks",
        {
          type: Sequelize.TEXT,
          allowNull: true,
        },
      );
    }

    if (!vendorPassVehiclesTable.workflowState) {
      await queryInterface.addColumn(
        "vendor_pass_vehicles",
        "workflowState",
        {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
      );
    }

    if (!vendorPassVehiclesTable.workflowActionStage) {
      await queryInterface.addColumn(
        "vendor_pass_vehicles",
        "workflowActionStage",
        {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
      );
    }

    if (!vendorPassVehiclesTable.workflowActionRemarks) {
      await queryInterface.addColumn(
        "vendor_pass_vehicles",
        "workflowActionRemarks",
        {
          type: Sequelize.TEXT,
          allowNull: true,
        },
      );
    }

    await queryInterface.addIndex(
      "vendor_pass_persons",
      ["vendorPassRequestId", "workflowState"],
      {
        name: "idx_vendor_pass_persons_request_workflow",
      },
    );

    await queryInterface.addIndex(
      "vendor_pass_vehicles",
      ["vendorPassRequestId", "workflowState"],
      {
        name: "idx_vendor_pass_vehicles_request_workflow",
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "vendor_pass_persons",
      "idx_vendor_pass_persons_request_workflow",
    );

    await queryInterface.removeIndex(
      "vendor_pass_vehicles",
      "idx_vendor_pass_vehicles_request_workflow",
    );

    await queryInterface.removeColumn(
      "vendor_pass_persons",
      "workflowState",
    );
    await queryInterface.removeColumn(
      "vendor_pass_persons",
      "workflowActionStage",
    );
    await queryInterface.removeColumn(
      "vendor_pass_persons",
      "workflowActionRemarks",
    );

    await queryInterface.removeColumn(
      "vendor_pass_vehicles",
      "workflowState",
    );
    await queryInterface.removeColumn(
      "vendor_pass_vehicles",
      "workflowActionStage",
    );
    await queryInterface.removeColumn(
      "vendor_pass_vehicles",
      "workflowActionRemarks",
    );
  },
};