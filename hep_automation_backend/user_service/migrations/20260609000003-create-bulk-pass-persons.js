"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("bulk_pass_persons", {
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
        allowNull: true,
      },

      rowNumber: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },

      aadhaar: {
        type: Sequelize.STRING(12),
        allowNull: false,
      },

      dob: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      gender: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },

      mobile: {
        type: Sequelize.STRING(15),
        allowNull: true,
      },

      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      vehicleNumber: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },

      vehicleType: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      photoPath: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      validationStatus: {
        type: Sequelize.STRING(10),
        defaultValue: "valid",
      },

      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("bulk_pass_persons", ["batchId"], {
      name: "idx_bpp_batch_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("bulk_pass_persons");
  },
};
