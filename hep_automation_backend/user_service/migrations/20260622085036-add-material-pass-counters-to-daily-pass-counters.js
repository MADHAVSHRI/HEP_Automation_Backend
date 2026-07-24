"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn(
            "daily_pass_counters",
            "materialPassRequestCounter",
            {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            }
        );

        await queryInterface.addColumn(
            "daily_pass_counters",
            "returnableCounter",
            {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            }
        );

        await queryInterface.addColumn(
            "daily_pass_counters",
            "nonReturnableCounter",
            {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            }
        );

        await queryInterface.addColumn(
            "daily_pass_counters",
            "surplusCounter",
            {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            }
        );

        await queryInterface.addColumn(
            "daily_pass_counters",
            "debrisCounter",
            {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeColumn(
            "daily_pass_counters",
            "materialPassRequestCounter"
        );

        await queryInterface.removeColumn(
            "daily_pass_counters",
            "returnableCounter"
        );

        await queryInterface.removeColumn(
            "daily_pass_counters",
            "nonReturnableCounter"
        );

        await queryInterface.removeColumn(
            "daily_pass_counters",
            "surplusCounter"
        );

        await queryInterface.removeColumn(
            "daily_pass_counters",
            "debrisCounter"
        );
    },
};