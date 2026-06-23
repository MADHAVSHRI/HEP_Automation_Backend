"use strict";

const fs = require("fs");
const path = require("path");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // Determine path of json file
    let jsonPath = path.resolve(__dirname, "data/countries+states+cities.json");
    if (!fs.existsSync(jsonPath)) {
      jsonPath = path.resolve(__dirname, "../../../../countries+states+cities.json");
    }

    if (!fs.existsSync(jsonPath)) {
      throw new Error(`countries+states+cities.json not found at ${jsonPath}`);
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    // Fetch all countries in the database to map their iso2 to database id
    const countries = await queryInterface.sequelize.query(
      'SELECT id, iso2 FROM countries;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const countryMap = {};
    for (const c of countries) {
      if (c.iso2) {
        countryMap[c.iso2.toUpperCase()] = c.id;
      }
    }

    // Fetch all states in the database to verify their existence
    const states = await queryInterface.sequelize.query(
      'SELECT id FROM states;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const stateIds = new Set(states.map(s => s.id));

    // Build the cities list
    const citiesToInsert = [];
    for (const country of data) {
      const countryId = countryMap[country.iso2.toUpperCase()];
      if (!countryId) {
        // Skip cities for countries that are not seeded in the database
        continue;
      }

      if (country.states) {
        for (const state of country.states) {
          if (!stateIds.has(state.id)) {
            // Skip cities for states that were not seeded
            continue;
          }

          if (state.cities) {
            for (const city of state.cities) {
              citiesToInsert.push({
                id: city.id,
                name: city.name,
                stateId: state.id,
                isActive: true,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      }
    }

    // Bulk insert in chunks to avoid parameter limits in Postgres (max 65,535 parameters)
    const chunkSize = 5000;
    for (let i = 0; i < citiesToInsert.length; i += chunkSize) {
      const chunk = citiesToInsert.slice(i, i + chunkSize);
      await queryInterface.bulkInsert("cities", chunk);
    }

    // Reset the auto-increment sequence in Postgres for cities table
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        "SELECT setval('cities_id_seq', COALESCE((SELECT MAX(id)+1 FROM cities), 1), false);"
      );
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("cities", null, {});
  },
};
