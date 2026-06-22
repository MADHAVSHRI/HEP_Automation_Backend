const { pool } = require("../dbconfig/db");

const Blacklist = {
  /**
   * Create a new blacklist entry and its initial audit log.
   */
  async createEntry(data) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const insertQuery = `
        INSERT INTO blacklist_entries (
          entity_type, identifier, entity_name, reason, scenario,
          has_penalty, penalty_amount, penalty_status, status,
          blacklisted_by, blacklisted_at, reason_code, authorizing_officer,
          supporting_document_path, geotag_latitude, geotag_longitude, geotag_accuracy,
          permit_one_gate_out
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `;

      const penaltyStatus = data.has_penalty ? "PENDING" : "NOT_APPLICABLE";
      const values = [
        data.entity_type,
        data.identifier.toUpperCase().trim(),
        data.entity_name || null,
        data.reason,
        data.scenario || null,
        data.has_penalty || false,
        data.has_penalty ? data.penalty_amount : null,
        penaltyStatus,
        data.status || 'BLACKLISTED',
        data.blacklisted_by,
        data.reason_code || null,
        data.authorizing_officer || null,
        data.supporting_document_path || null,
        data.geotag_latitude ? parseFloat(data.geotag_latitude) : null,
        data.geotag_longitude ? parseFloat(data.geotag_longitude) : null,
        data.geotag_accuracy ? parseFloat(data.geotag_accuracy) : null,
        data.permit_one_gate_out || false
      ];

      const result = await client.query(insertQuery, values);
      const entry = result.rows[0];

      // Insert audit log
      await client.query(
        `INSERT INTO blacklist_audit_log (blacklist_id, action, performed_by, remarks)
         VALUES ($1, 'BLACKLISTED', $2, $3)`,
        [entry.id, data.blacklisted_by, data.reason]
      );

      await client.query("COMMIT");
      return entry;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * List blacklist entries with optional filters, search, and pagination.
   */
  async getEntries({ status, entity_type, search, page = 1, limit = 20 } = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`b.status = $${paramIndex++}`);
      params.push(status);
    }

    if (entity_type) {
      conditions.push(`b.entity_type = $${paramIndex++}`);
      params.push(entity_type);
    }

    if (search) {
      conditions.push(
        `(b.identifier ILIKE $${paramIndex} OR b.entity_name ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const offset = (page - 1) * limit;

    const countQuery = `SELECT COUNT(*) FROM blacklist_entries b ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT
        b.*,
        u1."userName" AS blacklisted_by_name,
        u2."userName" AS unblacklisted_by_name
      FROM blacklist_entries b
      LEFT JOIN "users" u1 ON b.blacklisted_by = u1.id
      LEFT JOIN "users" u2 ON b.unblacklisted_by = u2.id
      ${whereClause}
      ORDER BY b."createdAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    params.push(limit, offset);
    const dataResult = await pool.query(dataQuery, params);

    return {
      data: dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get a single blacklist entry by ID, including its audit log.
   */
  async getById(id) {
    const entryQuery = `
      SELECT
        b.*,
        u1."userName" AS blacklisted_by_name,
        u2."userName" AS unblacklisted_by_name
      FROM blacklist_entries b
      LEFT JOIN "users" u1 ON b.blacklisted_by = u1.id
      LEFT JOIN "users" u2 ON b.unblacklisted_by = u2.id
      WHERE b.id = $1
    `;

    const entryResult = await pool.query(entryQuery, [id]);
    if (entryResult.rows.length === 0) return null;

    const auditQuery = `
      SELECT
        a.*,
        u."userName" AS performed_by_name
      FROM blacklist_audit_log a
      LEFT JOIN "users" u ON a.performed_by = u.id
      WHERE a.blacklist_id = $1
      ORDER BY a."createdAt" ASC
    `;

    const auditResult = await pool.query(auditQuery, [id]);

    return {
      ...entryResult.rows[0],
      auditLog: auditResult.rows,
    };
  },

  /**
   * Update the penalty status of a blacklist entry (e.g. PENDING → PAID).
   */
  async updatePenaltyStatus(id, penaltyStatus, userId, remarks, paymentMethod, transactionId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE blacklist_entries 
         SET penalty_status = $1, 
             payment_method = $2, 
             transaction_id = $3, 
             "updatedAt" = NOW() 
         WHERE id = $4`,
        [penaltyStatus, paymentMethod || null, transactionId || null, id]
      );

      const auditRemarks = remarks 
        ? `${remarks} (Paid via ${paymentMethod || "UNKNOWN"} - Txn: ${transactionId || "N/A"})` 
        : `Penalty paid via ${paymentMethod || "UNKNOWN"} (Txn: ${transactionId || "N/A"})`;

      await client.query(
        `INSERT INTO blacklist_audit_log (blacklist_id, action, performed_by, remarks)
         VALUES ($1, 'PENALTY_PAID', $2, $3)`,
        [id, userId, auditRemarks]
      );

      await client.query("COMMIT");

      return this.getById(id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Submit compliance / corrective actions notes.
   */
  async submitCompliance(id, complianceNotes, userId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE blacklist_entries SET compliance_notes = $1, "updatedAt" = NOW() WHERE id = $2`,
        [complianceNotes, id]
      );

      await client.query(
        `INSERT INTO blacklist_audit_log (blacklist_id, action, performed_by, remarks)
         VALUES ($1, 'COMPLIANCE_SUBMITTED', $2, $3)`,
        [id, userId, complianceNotes]
      );

      await client.query("COMMIT");

      return this.getById(id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Request unblacklisting — sets status to UNBLACKLIST_REQUESTED.
   */
  async requestUnblacklist(id, userId, remarks) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE blacklist_entries SET status = 'UNBLACKLIST_REQUESTED', "updatedAt" = NOW() WHERE id = $1`,
        [id]
      );

      await client.query(
        `INSERT INTO blacklist_audit_log (blacklist_id, action, performed_by, remarks)
         VALUES ($1, 'UNBLACKLIST_REQUESTED', $2, $3)`,
        [id, userId, remarks || "Unblacklist request submitted"]
      );

      await client.query("COMMIT");

      return this.getById(id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Approve unblacklisting — Traffic Approval marks entity as UNBLACKLISTED.
   */
  async approveUnblacklist(id, userId, remarks) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE blacklist_entries
         SET status = 'UNBLACKLISTED',
             unblacklisted_by = $1,
             unblacklisted_at = NOW(),
             "updatedAt" = NOW()
         WHERE id = $2`,
        [userId, id]
      );

      await client.query(
        `INSERT INTO blacklist_audit_log (blacklist_id, action, performed_by, remarks)
         VALUES ($1, 'UNBLACKLIST_APPROVED', $2, $3)`,
        [id, userId, remarks || "Unblacklist approved"]
      );

      await client.query("COMMIT");

      return this.getById(id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Reject unblacklisting — Traffic Approval rejects, reverts to BLACKLISTED.
   */
  async rejectUnblacklist(id, userId, remarks) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE blacklist_entries SET status = 'BLACKLISTED', "updatedAt" = NOW() WHERE id = $1`,
        [id]
      );

      await client.query(
        `INSERT INTO blacklist_audit_log (blacklist_id, action, performed_by, remarks)
         VALUES ($1, 'UNBLACKLIST_REJECTED', $2, $3)`,
        [id, userId, remarks || "Unblacklist rejected"]
      );

      await client.query("COMMIT");

      return this.getById(id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Quick check: is a given entity currently blacklisted?
   */
  async checkBlacklisted(entityType, identifier) {
    const result = await pool.query(
      `SELECT id, entity_type, identifier, entity_name, reason, reason_code, status, penalty_status, penalty_amount
       FROM blacklist_entries
       WHERE entity_type = $1 AND identifier = $2 AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED')`,
      [entityType, identifier.toUpperCase().trim()]
    );

    return result.rows;
  },

  /**
   * Get summary statistics for the dashboard.
   */
  async getStats() {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'BLACKLISTED')              AS active_blacklisted,
        COUNT(*) FILTER (WHERE status = 'UNBLACKLIST_REQUESTED')    AS pending_unblacklist,
        COUNT(*) FILTER (WHERE status = 'PENDING_BLACKLIST')        AS pending_blacklist,
        COUNT(*) FILTER (WHERE penalty_status = 'PENDING')          AS pending_penalties,
        COALESCE(SUM(penalty_amount) FILTER (WHERE penalty_status = 'PENDING'), 0) AS pending_penalties_sum,
        COUNT(*) FILTER (WHERE status = 'UNBLACKLISTED')            AS total_unblacklisted,
        COUNT(*)                                                     AS total
      FROM blacklist_entries
    `);

    return result.rows[0];
  },

  /**
   * Directly unblock an entity (ATM unblocks Vehicle, Person, Driver).
   */
  async directUnblock(id, userId, remarks) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE blacklist_entries
         SET status = 'UNBLACKLISTED',
             unblacklisted_by = $1,
             unblacklisted_at = NOW(),
             "updatedAt" = NOW()
         WHERE id = $2`,
        [userId, id]
      );

      await client.query(
        `INSERT INTO blacklist_audit_log (blacklist_id, action, performed_by, remarks)
         VALUES ($1, 'UNBLACKLISTED', $2, $3)`,
        [id, userId, remarks || "Directly unblocked by ATM"]
      );

      await client.query("COMMIT");

      return this.getById(id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Reinstatement workflow for senior officials (Traffic Department) to reverse company blacklisting.
   */
  async reinstateCompany(id, userId, justification) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE blacklist_entries
         SET status = 'UNBLACKLISTED',
             unblacklisted_by = $1,
             unblacklisted_at = NOW(),
             reinstatement_justification = $2,
             "updatedAt" = NOW()
         WHERE id = $3`,
        [userId, justification, id]
      );

      await client.query(
        `INSERT INTO blacklist_audit_log (blacklist_id, action, performed_by, remarks)
         VALUES ($1, 'REINSTATED', $2, $3)`,
        [id, userId, justification || "Company blacklisting reversed by Traffic Department"]
      );

      await client.query("COMMIT");

      return this.getById(id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Record that a vehicle used its one permitted Gate OUT transaction.
   */
  async useGateOut(vehicleNo) {
    const query = `
      UPDATE blacklist_entries
      SET gate_out_used = true,
          "updatedAt" = NOW()
      WHERE entity_type = 'VEHICLE'
        AND identifier = $1
        AND status = 'BLACKLISTED'
        AND permit_one_gate_out = true
        AND gate_out_used = false
      RETURNING *
    `;
    const result = await pool.query(query, [vehicleNo.toUpperCase().trim()]);
    return result.rows[0] || null;
  },
};

module.exports = Blacklist;
