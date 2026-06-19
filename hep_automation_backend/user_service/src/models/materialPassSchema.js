const { pool } = require("../dbconfig/db");

const portLocations = {
  async getAllPortLocations() {
    const query = `
      SELECT id, name
      FROM locations
      ORDER BY name ASC
    `;

    const result = await pool.query(query);

    return result.rows;
  },
};

module.exports = portLocations 