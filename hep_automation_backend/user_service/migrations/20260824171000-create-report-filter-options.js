"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("report_filter_options", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      groupKey: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      value: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      sortOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addConstraint("report_filter_options", {
      fields: ["groupKey", "value"],
      type: "unique",
      name: "uq_report_filter_options_group_value",
    });

    const now = new Date();
    await queryInterface.bulkInsert("report_filter_options", [
      {
        groupKey: "revenue_transaction_type",
        value: "CREDIT",
        label: "Credit",
        sortOrder: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        groupKey: "revenue_transaction_type",
        value: "DEBIT",
        label: "Debit",
        sortOrder: 2,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("report_filter_options");
  },
};
