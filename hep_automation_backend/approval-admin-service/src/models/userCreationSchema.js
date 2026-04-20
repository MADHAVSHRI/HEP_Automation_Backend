const { pool } = require("../dbconfig/db");

const User = {

  async createUser(userData) {

    const query = `
      INSERT INTO "users"(
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
      `SELECT * FROM "port_departments"`
    );

    return result.rows;

  },

  async getDeptAdminUsers() {

    const query = `
      SELECT 
        u.id,
        u."userName",
        u.email,
        u."phoneNumber",
        r."roleName",
        d."departmentName"
      FROM "users" u
      JOIN "port_department_roles" r 
        ON u."roleId" = r.id
      JOIN "port_departments" d 
        ON u."departmentId" = d.id
      WHERE r."roleName" != 'Admin'
    `;

    const result = await pool.query(query);

    return result.rows;
  },

  async getAdminUsers() {

    const query = `
      SELECT 
        u.id,
        u."userName",
        u.email,
        u."phoneNumber",
        r."roleName",
        d."departmentName"
      FROM "users" u
      JOIN "port_department_roles" r 
        ON u."roleId" = r.id
      JOIN "port_departments" d 
        ON u."departmentId" = d.id
      WHERE r."roleName" = 'Admin'
    `;

    const result = await pool.query(query);

    return result.rows;
  },

  async getAdminLoginUser(loginId) {  

    const query = `
      SELECT
        u.id,
        u.password,
        u."isApprovedByAdmin",
        u."status",
        u."departmentId",
        r."roleName" AS role,
        d."departmentName" AS departmentName

      FROM "users" u

      JOIN "port_department_roles" r
        ON u."roleId" = r.id

      LEFT JOIN "port_departments" d
        ON u."departmentId" = d.id

      WHERE u."userName" = $1
    `;

    const result = await pool.query(query, [loginId]);

    return result.rows[0];
  },

  async updateUserApproval(userId, approved) {

    const status = approved ? "active" : "inactive";

    const query = `
      UPDATE "users"
      SET
        "isApprovedByAdmin" = $1,
        "status" = $2,
        "updatedAt" = NOW()
      WHERE id = $3
      RETURNING id,"userName",email,status,"isApprovedByAdmin"
    `;

    const result = await pool.query(query, [
      approved,
      status,
      userId
    ]);

    return result.rows[0];

  }

  };

module.exports = User;