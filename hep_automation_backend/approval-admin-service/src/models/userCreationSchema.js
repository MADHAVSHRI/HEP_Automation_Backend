const { pool } = require("../dbconfig/db");

const User = {

  async createUser(userData) {

    const query = `
      INSERT INTO "Port_users"(
        "userName",
        "email",
        "phoneNumber",
        "roleId",
        "departmentId",
        "password"
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `;

    const values = [
      userData.userName,
      userData.email,
      userData.phoneNumber,
      userData.roleId,
      userData.departmentId,
      userData.password
    ];

    const result = await pool.query(query, values);

    return result.rows[0];

  },

  async getRoles() {

    const result = await pool.query(
      `SELECT * FROM "port_department_roles"`
    );

    return result.rows;

  },

  async getDepartments() {

    const result = await pool.query(
      `SELECT * FROM "Port_departments"`
    );

    return result.rows;

  }

};

module.exports = User;