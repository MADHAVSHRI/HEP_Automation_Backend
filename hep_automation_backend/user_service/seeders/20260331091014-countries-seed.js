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

    const countriesToInsert = data.map((country) => ({
      id: country.id,
      name: country.name,
      iso2: country.iso2,
      iso3: country.iso3,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }));

    // Fetch existing country IDs and ISO2 codes to prevent duplicate rows
    const existingCountries = await queryInterface.sequelize.query(
      'SELECT id, iso2 FROM countries;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const existingIds = new Set((existingCountries || []).map((c) => c.id));
    const existingIso2 = new Set(
      (existingCountries || [])
        .map((c) => (c.iso2 ? c.iso2.toUpperCase() : null))
        .filter(Boolean)
    );

    const newCountriesToInsert = countriesToInsert.filter(
      (c) =>
        !existingIds.has(c.id) &&
        (!c.iso2 || !existingIso2.has(c.iso2.toUpperCase()))
    );

    // Bulk insert missing countries only
    if (newCountriesToInsert.length > 0) {
      await queryInterface.bulkInsert("countries", newCountriesToInsert);
    }

    // Reset the auto-increment sequence in Postgres for countries table
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        "SELECT setval('countries_id_seq', COALESCE((SELECT MAX(id)+1 FROM countries), 1), false);"
      );
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("countries", null, {});
  },
};
