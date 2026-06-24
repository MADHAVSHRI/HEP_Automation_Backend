"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("bulk_pass_uploads", {
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

      fileName: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },

      filePath: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },

      rowCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },

      uploadedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("bulk_pass_uploads", ["batchId"], {
      name: "idx_bpu_batch_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("bulk_pass_uploads");
  },
};
