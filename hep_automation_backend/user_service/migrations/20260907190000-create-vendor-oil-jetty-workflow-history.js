"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("vendor_oil_jetty_workflow_history", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      vendorPassRequestId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "vendor_pass_requests",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      stage: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      departmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      roleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      action: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      actedByUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      actedByUserName: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addIndex(
      "vendor_oil_jetty_workflow_history",
      ["vendorPassRequestId"],
      {
        name: "idx_vendor_oil_jetty_history_request",
      },
    );

    await queryInterface.addIndex(
      "vendor_oil_jetty_workflow_history",
      ["vendorPassRequestId", "stage"],
      {
        name: "idx_vendor_oil_jetty_history_request_stage",
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "vendor_oil_jetty_workflow_history",
      "idx_vendor_oil_jetty_history_request_stage",
    );

    await queryInterface.removeIndex(
      "vendor_oil_jetty_workflow_history",
      "idx_vendor_oil_jetty_history_request",
    );

    await queryInterface.dropTable("vendor_oil_jetty_workflow_history");
  },
};
