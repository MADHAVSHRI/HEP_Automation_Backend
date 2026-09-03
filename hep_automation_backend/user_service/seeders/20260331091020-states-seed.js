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

    // Build the states list
    const statesToInsert = [];
    for (const country of data) {
      const countryId = countryMap[country.iso2.toUpperCase()];
      if (!countryId) {
        // Skip states for countries that are not seeded in the database
        continue;
      }

      if (country.states) {
        for (const state of country.states) {
          statesToInsert.push({
            id: state.id,
            name: state.name,
            iso2: state.iso2 || null,
            countryId: countryId,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    // Fetch existing state IDs and normalized country+name keys to prevent duplicate rows
    const existingStates = await queryInterface.sequelize.query(
      'SELECT id, "countryId", lower(btrim(name::text)) AS name_key FROM states;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const existingStateIds = new Set((existingStates || []).map((s) => s.id));
    const existingStateKeys = new Set((existingStates || []).map((s) => `${s.countryId}|${s.name_key}`));

    const seenStateKeys = new Set();
    const newStatesToInsert = statesToInsert.filter((state) => {
      if (existingStateIds.has(state.id)) {
        return false;
      }

      const normalizedKey = `${state.countryId}|${String(state.name || "").trim().toLowerCase()}`;
      if (existingStateKeys.has(normalizedKey) || seenStateKeys.has(normalizedKey)) {
        return false;
      }

      seenStateKeys.add(normalizedKey);
      return true;
    });

    // Bulk insert in chunks to avoid parameter limits in Postgres (max 65,535 parameters)
    if (newStatesToInsert.length > 0) {
      const chunkSize = 5000;
      for (let i = 0; i < newStatesToInsert.length; i += chunkSize) {
        const chunk = newStatesToInsert.slice(i, i + chunkSize);
        await queryInterface.bulkInsert("states", chunk);
      }
    }

    // Reset the auto-increment sequence in Postgres for states table
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        "SELECT setval('states_id_seq', COALESCE((SELECT MAX(id)+1 FROM states), 1), false);"
      );
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("states", null, {});
  },
};
