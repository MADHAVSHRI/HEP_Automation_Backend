const { pool } = require("../dbconfig/db");

/**
 * Raw-SQL data layer for bulk_pass_batches and related tables,
 * mirroring the style used in vendorPassRequestSchema.js.
 */
const BulkPassSchema = {

  /*
  ==========================================
  Create a new bulk pass batch
  ==========================================
  */
  async createBatch(data) {
    const query = `
      INSERT INTO "bulk_pass_batches" (
        "refNo",
        "token",
        "tokenActive",
        "createdByUserId",
        "departmentId",
        "departmentName",
        "visitorType",
        "companyName",
        "applicantEmail",
        "applicantMobile",
        "refDocNo",
        "workOrderRequired",
        "noOfPersons",
        "noOfVehicles",
        "paymentMode",
        "purpose",
        "validityFrom",
        "validityUpto",
        "remarks",
        "status",
        "linkValidityHours",
        "tokenExpiresAt",
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
        NOW(),NOW()
      )
      RETURNING *;
    `;

    const values = [
      data.refNo,
      data.token,
      data.tokenActive !== undefined ? data.tokenActive : true,
      data.createdByUserId,
      data.departmentId,
      data.departmentName,
      data.visitorType,
      data.companyName,
      data.applicantEmail,
      data.applicantMobile,
      data.refDocNo || null,
      data.workOrderRequired !== undefined ? !!data.workOrderRequired : false,
      Number(data.noOfPersons) || 0,
      Number(data.noOfVehicles) || 0,
      data.paymentMode || "CASH",
      data.purpose,
      data.validityFrom || null,
      data.validityUpto,
      data.remarks || null,
      data.status || "DRAFT",
      data.linkValidityHours || 48,
      data.tokenExpiresAt || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /*
  ==========================================
  Get batch by ID
  ==========================================
  */
  async getById(id) {
    const result = await pool.query(
      `SELECT * FROM "bulk_pass_batches" WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /*
  ==========================================
  Get batch by token
  ==========================================
  */
  async getByToken(token) {
    const result = await pool.query(
      `SELECT * FROM "bulk_pass_batches" WHERE "token" = $1`,
      [token]
    );
    const row = result.rows[0] || null;
    // Enforce time-based link expiry: if the link's window has elapsed, treat
    // the token as inactive so every applicant-facing flow rejects it.
    if (row && row.tokenExpiresAt && new Date(row.tokenExpiresAt).getTime() < Date.now()) {
      row.tokenActive = false;
    }
    return row;
  },

  /*
  ==========================================
  List batches with optional filters
  ==========================================
  */
  async list(filters = {}) {
    const where = [];
    const params = [];
    let i = 1;

    if (filters.createdByUserId) {
      where.push(`b."createdByUserId" = $${i++}`);
      params.push(filters.createdByUserId);
    }
    if (filters.departmentId) {
      where.push(`b."departmentId" = $${i++}`);
      params.push(filters.departmentId);
    }
    if (filters.status) {
      where.push(`b."status" = $${i++}`);
      params.push(filters.status);
    }
    if (filters.companyName) {
      where.push(`b."companyName" ILIKE $${i++}`);
      params.push(`%${filters.companyName}%`);
    }
    if (filters.refNo) {
      where.push(`b."refNo" ILIKE $${i++}`);
      params.push(`%${filters.refNo}%`);
    }
    // Combined search box: match against reference number OR company name.
    if (filters.search) {
      where.push(`(b."refNo" ILIKE $${i} OR b."companyName" ILIKE $${i})`);
      params.push(`%${filters.search}%`);
      i++;
    }
    if (filters.fromDate) {
      where.push(`b."createdAt" >= $${i++}`);
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      where.push(`b."createdAt" <= $${i++}`);
      params.push(`${filters.toDate} 23:59:59`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
      SELECT
        b.id,
        b."refNo",
        b."departmentId",
        b."departmentName",
        b."visitorType",
        b."companyName",
        b."noOfPersons",
        b."noOfVehicles",
        b."paymentMode",
        b."purpose",
        b."validityFrom",
        b."validityUpto",
        b."workOrderRequired",
        b."remarks",
        b."status",
        b."returnReason",
        b."rejectionReason",
        b."approvedAt",
        b."rejectedAt",
        b."qrPdfPath",
        b."createdAt",
        b."updatedAt",
        COALESCE(p.person_count, 0) AS "submittedPersonsCount",
        COALESCE(p.vehicle_count, 0) AS "submittedVehiclesCount"
      FROM "bulk_pass_batches" b
      LEFT JOIN (
        SELECT
          "batchId",
          COUNT(*) AS person_count,
          COUNT(CASE WHEN "vehicleNumber" IS NOT NULL AND "vehicleNumber" != '' THEN 1 END) AS vehicle_count
        FROM "bulk_pass_persons"
        GROUP BY "batchId"
      ) p ON p."batchId" = b.id
      ${whereSql}
      ORDER BY b."createdAt" DESC
      LIMIT 500
    `;

    const result = await pool.query(query, params);
    return result.rows;
  },

  /*
  ==========================================
  List UNDER_REVIEW batches oldest-first (for Traffic Officer queue)
  Requirements: 8.1
  ==========================================
  */
  async listApprovalQueue() {
    const query = `
      SELECT
        b.id,
        b."refNo",
        b."departmentId",
        b."departmentName",
        b."visitorType",
        b."companyName",
        b."noOfPersons",
        b."noOfVehicles",
        b."paymentMode",
        b."purpose",
        b."validityFrom",
        b."validityUpto",
        b."workOrderRequired",
        b."remarks",
        b."status",
        b."returnReason",
        b."rejectionReason",
        b."approvedAt",
        b."rejectedAt",
        b."qrPdfPath",
        b."createdAt",
        b."updatedAt",
        COALESCE(p.person_count, 0) AS "submittedPersonsCount",
        COALESCE(p.vehicle_count, 0) AS "submittedVehiclesCount"
      FROM "bulk_pass_batches" b
      LEFT JOIN (
        SELECT
          "batchId",
          COUNT(*) AS person_count,
          COUNT(CASE WHEN "vehicleNumber" IS NOT NULL AND "vehicleNumber" != '' THEN 1 END) AS vehicle_count
        FROM "bulk_pass_persons"
        GROUP BY "batchId"
      ) p ON p."batchId" = b.id
      WHERE b."status" = 'UNDER_REVIEW'
      ORDER BY b."createdAt" ASC
      LIMIT 500
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  /*
  ==========================================
  Update batch fields (for DRAFT / REJECTED edits)
  ==========================================
  */
  async updateBatch(id, data) {
    const allowedFields = [
      "visitorType",
      "companyName",
      "applicantEmail",
      "applicantMobile",
      "refDocNo",
      "workOrderRequired",
      "noOfPersons",
      "noOfVehicles",
      "paymentMode",
      "purpose",
      "validityFrom",
      "validityUpto",
      "remarks",
    ];

    const updates = ['"updatedAt" = NOW()'];
    const values = [id];
    let paramIndex = 2;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`"${field}" = $${paramIndex}`);
        if (field === "workOrderRequired") {
          values.push(!!data[field]);
        } else if (["noOfPersons", "noOfVehicles"].includes(field)) {
          values.push(Number(data[field]));
        } else {
          values.push(data[field]);
        }
        paramIndex++;
      }
    }

    const query = `
      UPDATE "bulk_pass_batches"
      SET ${updates.join(", ")}
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  },

  /*
  ==========================================
  Set batch status (with optional extra fields)
  ==========================================
  */
  async setStatus(id, status, extra = {}) {
    const setClauses = ['"status" = $2', '"updatedAt" = NOW()'];
    const values = [id, status];
    let paramIndex = 3;

    const extraAllowed = [
      "tokenActive",
      "returnReason",
      "rejectionReason",
      "qrPdfPath",
      "submittedAt",
      "lastEmailSentAt",
      "linkValidityHours",
      "tokenExpiresAt",
    ];

    for (const field of extraAllowed) {
      if (extra[field] !== undefined) {
        setClauses.push(`"${field}" = $${paramIndex}`);
        values.push(extra[field]);
        paramIndex++;
      }
    }

    const query = `
      UPDATE "bulk_pass_batches"
      SET ${setClauses.join(", ")}
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  },

  /*
  ==========================================
  Log a status transition to audit table
  ==========================================
  */
  async logTransition(batchId, status, changedBy, remarks = null) {
    const query = `
      INSERT INTO "bulk_pass_status_logs" (
        "batchId",
        "status",
        "changedBy",
        "remarks",
        "createdAt"
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [batchId, status, changedBy || null, remarks || null]);
    return result.rows[0];
  },

  /*
  ==========================================
  Batch-insert persons for a batch
  ==========================================
  */
  async deletePersonsByBatch(batchId) {
    const result = await pool.query(
      `DELETE FROM "bulk_pass_persons" WHERE "batchId" = $1`,
      [batchId]
    );
    return result.rowCount;
  },

  async insertPersons(batchId, rows) {
    if (!rows || rows.length === 0) return [];

    const inserted = [];

    for (const row of rows) {
      const result = await pool.query(
        `INSERT INTO "bulk_pass_persons" (
          "batchId",
          "fileName",
          "rowNumber",
          "name",
          "aadhaar",
          "dob",
          "mobile",
          "address",
          "vehicleNumber",
          "vehicleType",
          "photoPath",
          "vehicleDocs",
          "inCharge",
          "aadhaarCardPath",
          "validationStatus",
          "errorMessage",
          "createdAt"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW()
        )
        RETURNING *`,
        [
          batchId,
          row.fileName || null,
          row.rowNumber || null,
          row.name,
          row.aadhaar,
          row.dob || null,
          row.mobile || null,
          row.address || null,
          row.vehicleNumber || null,
          row.vehicleType || null,
          row.photoPath || null,
          row.vehicleDocs ? JSON.stringify(row.vehicleDocs) : null,
          row.inCharge === true,
          row.aadhaarCardPath || null,
          row.validationStatus || "valid",
          row.errorMessage || null,
        ]
      );
      inserted.push(result.rows[0]);
    }

    return inserted;
  },

  /*
  ==========================================
  Insert an upload record
  ==========================================
  */
  async insertUpload(data) {
    const result = await pool.query(
      `INSERT INTO "bulk_pass_uploads" (
        "batchId",
        "fileName",
        "filePath",
        "rowCount",
        "uploadedAt"
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING *`,
      [
        data.batchId,
        data.fileName,
        data.filePath,
        Number(data.rowCount) || 0,
      ]
    );
    return result.rows[0];
  },

  /*
  ==========================================
  Get all persons for a batch
  ==========================================
  */
  async getPersonsByBatch(batchId) {
    const result = await pool.query(
      `SELECT * FROM "bulk_pass_persons"
       WHERE "batchId" = $1
       ORDER BY "fileName" ASC, "rowNumber" ASC`,
      [batchId]
    );
    return result.rows;
  },

  /*
  ==========================================
  Get all upload records for a batch
  ==========================================
  */
  async getUploadsByBatch(batchId) {
    const result = await pool.query(
      `SELECT * FROM "bulk_pass_uploads"
       WHERE "batchId" = $1
       ORDER BY "uploadedAt" ASC`,
      [batchId]
    );
    return result.rows;
  },

  /*
  ==========================================
  Get status log for a batch (oldest first)
  ==========================================
  */
  async getStatusLog(batchId) {
    const result = await pool.query(
      `SELECT * FROM "bulk_pass_status_logs"
       WHERE "batchId" = $1
       ORDER BY "createdAt" ASC`,
      [batchId]
    );
    return result.rows;
  },
};

module.exports = BulkPassSchema;
