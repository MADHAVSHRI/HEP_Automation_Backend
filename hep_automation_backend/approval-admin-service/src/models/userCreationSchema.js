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

  async getDeptAdminUsers({ page = 1, limit = 20, search = "" } = {}) {
    const conditions = ["r.\"roleName\" != 'Admin'"];
    const params = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(
        `(u."userName" ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR d."departmentName" ILIKE $${paramIndex} OR r."roleName" ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) 
      FROM "users" u
      JOIN "port_department_roles" r ON u."roleId" = r.id
      JOIN "port_departments" d ON u."departmentId" = d.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const totalRecords = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT 
        u.id,
        u."userName",
        u.email,
        u."phoneNumber",
        u.status,
        u."isApprovedByAdmin",
        u."createdAt",
        r."roleName",
        d."departmentName"
      FROM "users" u
      JOIN "port_department_roles" r 
        ON u."roleId" = r.id
      JOIN "port_departments" d 
        ON u."departmentId" = d.id
      ${whereClause}
      ORDER BY u."createdAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    const statsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE u.status = 'active') AS active_count,
        COUNT(*) FILTER (WHERE u.status != 'active') AS inactive_count
      FROM "users" u
      JOIN "port_department_roles" r ON u."roleId" = r.id
      WHERE r."roleName" != 'Admin'
    `;
    const statsResult = await pool.query(statsQuery);
    const activeCount = parseInt(statsResult.rows[0].active_count, 10);
    const inactiveCount = parseInt(statsResult.rows[0].inactive_count, 10);

    params.push(limit, offset);
    const result = await pool.query(dataQuery, params);

    return {
      data: result.rows,
      pagination: {
        totalRecords,
        currentPage: page,
        totalPages: Math.ceil(totalRecords / limit),
        pageSize: limit
      },
      stats: {
        activeCount,
        inactiveCount,
        totalCount: totalRecords
      }
    };
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
        u."roleId",
        r."roleName" AS role,
        d."departmentName" AS "departmentName"

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

  },

  async findUserByEmail(email) {
    const query = `
      SELECT
        u.id,
        u."userName",
        u.email,
        u."isApprovedByAdmin",
        u.status,
        u."isPasswordChanged"
      FROM "users" u
      WHERE u.email = $1
    `;
    const result = await pool.query(query, [email]);
    return result.rows[0];
  },

  async updateUserPassword(userId, hashedPassword) {
    const query = `
      UPDATE "users"
      SET
        "password" = $1,
        "isPasswordChanged" = true,
        "updatedAt" = NOW()
      WHERE id = $2
      RETURNING id, "userName", email, "isPasswordChanged"
    `;
    const result = await pool.query(query, [hashedPassword, userId]);
    return result.rows[0];
  },

  async findUserById(id) {
    const query = `
      SELECT
        u.id,
        u."userName",
        u.email,
        u."isApprovedByAdmin",
        u.status,
        u."isPasswordChanged"
      FROM "users" u
      WHERE u.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  };

module.exports = User;