const { pool } = require("../dbconfig/db");

const UserType = {

  async getAllUserTypes() {

    const query = `
      SELECT
        id,
        name,
        document_instruction
      FROM "User_types"
      ORDER BY name ASC
    `;

    const result = await pool.query(query);

    return result.rows;
  }

};

module.exports = UserType;