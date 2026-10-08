const { pool } = require("../dbconfig/db");

const AccountDeletion = {
  /**
   * Auto-initialize the table if it does not exist
   */
  async initTable() {
    try {
      const query = `
        CREATE TABLE IF NOT EXISTS "account_deletion_requests" (
          "id" SERIAL PRIMARY KEY,
          "userId" INTEGER,
          "userType" VARCHAR(50) NOT NULL DEFAULT 'agent',
          "loginId" VARCHAR(100) NOT NULL,
          "email" VARCHAR(255),
          "reason" TEXT,
          "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
          "ipAddress" VARCHAR(100),
          "userAgent" TEXT,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "reviewedBy" VARCHAR(100),
          "reviewedAt" TIMESTAMP WITH TIME ZONE,
          "adminNotes" TEXT
        );

        CREATE INDEX IF NOT EXISTS "idx_account_deletion_login_id" 
          ON "account_deletion_requests" ("loginId");
        CREATE INDEX IF NOT EXISTS "idx_account_deletion_status" 
          ON "account_deletion_requests" ("status");
      `;
      await pool.query(query);
    } catch (err) {
      console.error("[ACCOUNT_DELETION_SCHEMA] Table initialization error:", err.message);
    }
  },

  /**
   * Create a new deletion request
   */
  async createRequest({ userId, userType, loginId, email, reason, ipAddress, userAgent }) {
    await this.initTable();
    const query = `
      INSERT INTO "account_deletion_requests"
        ("userId", "userType", "loginId", "email", "reason", "status", "ipAddress", "userAgent", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7, NOW(), NOW())
      RETURNING *;
    `;
    const values = [
      userId || null,
      userType || "agent",
      loginId,
      email || null,
      reason || "User requested account deletion via portal",
      ipAddress || null,
      userAgent || null,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Find any active pending deletion request for a loginId
   */
  async findPendingByLoginId(loginId) {
    await this.initTable();
    const query = `
      SELECT * FROM "account_deletion_requests"
      WHERE "loginId" = $1 AND "status" = 'PENDING'
      ORDER BY "createdAt" DESC
      LIMIT 1;
    `;
    const result = await pool.query(query, [loginId]);
    return result.rows[0];
  },

  /**
   * Fetch all deletion requests (for administration)
   */
  async getAllRequests({ status, search, limit = 50, offset = 0 } = {}) {
    await this.initTable();
    let query = `SELECT * FROM "account_deletion_requests"`;
    const conditions = [];
    const params = [];

    if (status && status !== "ALL") {
      params.push(status);
      conditions.push(`"status" = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`("loginId" ILIKE $${params.length} OR "email" ILIKE $${params.length} OR "reason" ILIKE $${params.length})`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY "createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQuery = `SELECT COUNT(*) FROM "account_deletion_requests"`;
    const countParams = [];
    if (status && status !== "ALL") {
      countParams.push(status);
    }
    if (search && search.trim()) {
      countParams.push(`%${search.trim()}%`);
    }
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(" AND ")}`;
    }
    const countResult = await pool.query(countQuery, countParams);

    return {
      records: result.rows,
      total: parseInt(countResult.rows[0]?.count || 0, 10),
    };
  },

  /**
   * Update request status (e.g. APPROVED, REJECTED, PROCESSED)
   */
  async updateRequestStatus(id, { status, reviewedBy, adminNotes }) {
    await this.initTable();
    const query = `
      UPDATE "account_deletion_requests"
      SET "status" = $1, "reviewedBy" = $2, "adminNotes" = $3, "reviewedAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = $4
      RETURNING *;
    `;
    const result = await pool.query(query, [status, reviewedBy, adminNotes, id]);
    const updated = result.rows[0];

    // If approved, deactivate account immediately
    if (updated && status === "APPROVED") {
      try {
        if (updated.userType === "agent" || updated.loginId.startsWith("190")) {
          await pool.query(
            `UPDATE "Agents" SET status = 'disabled', "isApproved" = false WHERE "loginId" = $1`,
            [updated.loginId]
          );
        } else {
          await pool.query(
            `UPDATE "users" SET status = 'disabled', "isApprovedByAdmin" = false WHERE "userName" = $1`,
            [updated.loginId]
          );
        }
      } catch (deactivateErr) {
        console.error("[ACCOUNT_DELETION] Deactivation query failed:", deactivateErr.message);
      }
    }

    return updated;
  },
};

// Run table initialization on module load
AccountDeletion.initTable().catch(() => {});

module.exports = AccountDeletion;
