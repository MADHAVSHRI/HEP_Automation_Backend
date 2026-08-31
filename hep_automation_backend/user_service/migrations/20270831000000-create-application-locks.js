"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("application_locks", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      application_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      application_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: "pass, vendor-pass, or company",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      user_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      locked_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addConstraint("application_locks", {
      fields: ["application_id", "application_type"],
      type: "unique",
      name: "unique_app_lock",
    });

    await queryInterface.addIndex("application_locks", ["application_id", "application_type"], {
      name: "idx_app_locks_lookup",
    });

    await queryInterface.addIndex("application_locks", ["expires_at"], {
      name: "idx_app_locks_expires",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("application_locks");
  },
};
