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

    // Bulk insert countries
    await queryInterface.bulkInsert("countries", countriesToInsert);

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
