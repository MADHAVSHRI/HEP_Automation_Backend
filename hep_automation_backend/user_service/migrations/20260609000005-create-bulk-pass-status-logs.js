"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("bulk_pass_status_logs", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      batchId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "bulk_pass_batches",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      changedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("bulk_pass_status_logs", ["batchId"], {
      name: "idx_bpsl_batch_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("bulk_pass_status_logs");
  },
};
