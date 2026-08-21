const { pool } = require("../dbconfig/db");

/**
 * Raw-SQL data layer for bulk_pass_batches and related tables,
 * mirroring the style used in vendorPassRequestSchema.js.
 */
const BulkPassSchema = {

  /*
  ==========================================
  Create a new bulk pass batch
  Requirements: 2.1-2.6, 9.4, 9.5
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
        "multipleSubmissionsEnabled",
        "parent_request_id",
        "submission_number",
        "request_source",
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
        $23,$24,$25,$26,
        NOW(),NOW()
      )
      RETURNING *;
    `;

    const values = [
      data.refNo || null,
      data.token || null,
      data.tokenActive !== undefined ? !!data.tokenActive : true,
      data.createdByUserId || 1,
      data.departmentId || 6,
      data.departmentName || "General Administration",
      data.visitorType || "BUSINESS",
      data.companyName || "N/A",
      data.applicantEmail || "N/A",
      data.applicantMobile || "N/A",
      data.refDocNo || null,
      data.workOrderRequired !== undefined ? !!data.workOrderRequired : false,
      Number(data.noOfPersons) || 0,
      Number(data.noOfVehicles) || 0,
      data.paymentMode || "CASH",
      data.purpose || "Bulk Pass Entry",
      data.validityFrom || null,
      data.validityUpto || new Date(Date.now() + 30 * 86400000).toISOString(),
      data.remarks || null,
      data.status || "DRAFT",
      data.linkValidityHours || 48,
      data.tokenExpiresAt || null,
      data.multipleSubmissionsEnabled !== undefined ? !!data.multipleSubmissionsEnabled : false,
      data.parent_request_id || null,
      Number(data.submission_number) || 1,
      data.request_source || "DEPARTMENT",
    ];

    const sanitizedValues = values.map((v) => (v === undefined ? null : v));
    const result = await pool.query(query, sanitizedValues);
    return result.rows[0];
  },

  /*
  ==========================================
  Get batch by ID
  Requirements: 2.3, 9.4
  ==========================================
  */
  async getById(id) {
    const result = await pool.query(
      `SELECT
         id,
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
         remarks,
         status,
         "linkValidityHours",
         "tokenExpiresAt",
         "returnReason",
         "rejectionReason",
         "lastEmailSentAt",
         "qrPdfPath",
         "multipleSubmissionsEnabled",
         "parent_request_id",
         "submission_number",
         "request_source",
         "createdAt",
         "updatedAt"
       FROM "bulk_pass_batches"
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /*
  ==========================================
  Get batch by token
  Requirements: 2.3, 9.4, 3.2
  ==========================================
  */
  async getByToken(token) {
    const result = await pool.query(
      `SELECT
         id,
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
         remarks,
         status,
         "linkValidityHours",
         "tokenExpiresAt",
         "returnReason",
         "rejectionReason",
         "lastEmailSentAt",
         "qrPdfPath",
         "multipleSubmissionsEnabled",
         "parent_request_id",
         "submission_number",
         "request_source",
         "createdAt",
         "updatedAt"
       FROM "bulk_pass_batches"
       WHERE "token" = $1`,
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
    if (filters.multipleSubmissionsEnabled !== undefined) {
      if (filters.multipleSubmissionsEnabled) {
        where.push(`b."multipleSubmissionsEnabled" = true`);
      } else {
        where.push(`(b."multipleSubmissionsEnabled" = false OR b."multipleSubmissionsEnabled" IS NULL)`);
      }
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
        b."qrPdfPath",
        b."createdAt",
        b."updatedAt",
        b."multipleSubmissionsEnabled",
        COALESCE(p.person_count, 0) AS "submittedPersonsCount",
        COALESCE(p.vehicle_count, 0) AS "submittedVehiclesCount",
        COALESCE(c.child_count, 0) AS "childSubmissionsCount"
      FROM "bulk_pass_batches" b
      LEFT JOIN (
        SELECT
          "batchId",
          COUNT(*) AS person_count,
          COUNT(CASE WHEN "vehicleNumber" IS NOT NULL AND "vehicleNumber" != '' THEN 1 END) AS vehicle_count
        FROM "bulk_pass_persons"
        GROUP BY "batchId"
      ) p ON p."batchId" = b.id
      LEFT JOIN (
        SELECT
          parent_request_id AS parent_id,
          COUNT(*) AS child_count
        FROM "bulk_pass_batches"
        GROUP BY parent_request_id
      ) c ON c.parent_id = b.id
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
          "driverLicenseNumber",
          "driverLicensePath",
          "validationStatus",
          "errorMessage",
          "createdAt"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW()
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
          row.driverLicenseNumber || null,
          row.driverLicensePath || null,
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
  Get a single person by id
  ==========================================
  */
  async getPersonById(personId) {
    const result = await pool.query(
      `SELECT * FROM "bulk_pass_persons" WHERE id = $1`,
      [personId]
    );
    return result.rows[0] || null;
  },

  /*
  ==========================================
  Set approval status for a single person
  ==========================================
  */
  async setPersonApprovalStatus(personId, approvalStatus, approvalReason, approvedBy) {
    const result = await pool.query(
      `UPDATE "bulk_pass_persons"
       SET "approvalStatus" = $2,
           "approvalReason" = $3,
           "approvedBy"     = $4,
           "approvedAt"     = NOW()
       WHERE id = $1
       RETURNING *`,
      [personId, approvalStatus, approvalReason || null, approvedBy || null]
    );
    return result.rows[0] || null;
  },

  /*
  ==========================================
  Count persons by approvalStatus for a batch
  Returns { total, pending, approved, rejected }
  ==========================================
  */
  async getPersonApprovalSummary(batchId) {
    const result = await pool.query(
      `SELECT
         COUNT(*)                                                                              AS total,
         COUNT(*) FILTER (WHERE COALESCE("approvalStatus", 'PENDING') = 'PENDING')            AS pending,
         COUNT(*) FILTER (WHERE "approvalStatus" = 'APPROVED')                                AS approved,
         COUNT(*) FILTER (WHERE "approvalStatus" = 'REJECTED')                                AS rejected
       FROM "bulk_pass_persons"
       WHERE "batchId" = $1 AND "vehicleNumber" IS NULL`,
      [batchId]
    );
    const row = result.rows[0];
    return {
      total:    Number(row.total),
      pending:  Number(row.pending),
      approved: Number(row.approved),
      rejected: Number(row.rejected),
    };
  },

  /*
  ==========================================
  Get only APPROVED persons for a batch
  (used by QR/PDF generation)
  ==========================================
  */
  async getApprovedPersonsByBatch(batchId) {
    const result = await pool.query(
      `SELECT * FROM "bulk_pass_persons"
       WHERE "batchId" = $1 AND "approvalStatus" = 'APPROVED'
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

  /*
  ==========================================
  Get child batches for a parent batch or parent request
  Requirements: 10.1, 10.2, 4.1
  
  @param {number} parentId - The parent_request_id to query
  @param {string} source - Filter by request_source (optional): 'DEPARTMENT' or 'PUBLIC_WEBSITE'
  @returns {Array} Child batches with submission details
  ==========================================
  */
  async getChildBatches(parentId, source = null) {
    const params = [parentId];
    let sourceFilter = '';
    
    if (source) {
      sourceFilter = 'AND b."request_source" = $2';
      params.push(source);
    }

    const query = `
      SELECT
        b.id,
        b."refNo",
        b."submission_number",
        b.status,
        b."noOfPersons",
        b."noOfVehicles",
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
      WHERE b.parent_request_id = $1
      ${sourceFilter}
      ORDER BY b."submission_number" ASC
    `;

    const result = await pool.query(query, params);
    return result.rows;
  },

  /*
  ==========================================
  Get next submission number for a parent
  Requirements: 10.3, 10.4, 9.5
  
  @param {number} parentId - The parent_request_id to query
  @param {string} source - Filter by request_source (optional): 'DEPARTMENT' or 'PUBLIC_WEBSITE'
  @returns {number} Next submission number (starts from 1)
  ==========================================
  */
  async getNextSubmissionNumber(parentId, source = null) {
    const params = [parentId];
    let sourceFilter = '';
    
    if (source) {
      sourceFilter = 'AND "request_source" = $2';
      params.push(source);
    }

    const query = `
      SELECT COALESCE(MAX("submission_number"), 0) + 1 AS next_number
      FROM "bulk_pass_batches"
      WHERE parent_request_id = $1
      ${sourceFilter}
    `;

    const result = await pool.query(query, params);
    return Number(result.rows[0]?.next_number) || 1;
  },

  /*
  ==========================================
  Get parent batch by ID (for self-referential relationship)
  This method helps retrieve the parent batch when dealing with
  department-initiated multiple submissions where a batch can be
  a parent to other batches.
  Requirements: 2.3, 9.4
  
  @param {number} parentId - The parent_request_id that references another batch
  @returns {Object|null} Parent batch object or null
  ==========================================
  */
  async getParentBatch(parentId) {
    // Since parent_request_id can reference either bulk_pass_parent_requests
    // OR another bulk_pass_batches row, we check if the parentId exists as a batch
    const result = await pool.query(
      `SELECT
         id,
         "refNo",
         "token",
         "tokenActive",
         "multipleSubmissionsEnabled",
         "validityFrom",
         "validityUpto",
         "companyName",
         "departmentId",
         "departmentName",
         "request_source",
         status,
         "createdAt"
       FROM "bulk_pass_batches"
       WHERE id = $1 AND "multipleSubmissionsEnabled" = true`,
      [parentId]
    );
    return result.rows[0] || null;
  },

  /*
  ==========================================
  Check if batch is a parent batch (has children)
  Requirements: 2.2, 2.3
  
  @param {number} batchId - The batch ID to check
  @returns {boolean} True if batch has child batches
  ==========================================
  */
  async hasChildBatches(batchId) {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM "bulk_pass_batches"
       WHERE parent_request_id = $1`,
      [batchId]
    );
    return Number(result.rows[0]?.count) > 0;
  },

  /*
  ==========================================
  Check if batch allows multiple submissions
  Requirements: 1.1, 1.3, 2.1
  
  @param {Object} batch - The batch object
  @returns {boolean} True if multiple submissions enabled
  ==========================================
  */
  isMultipleSubmissionsEnabled(batch) {
    if (!batch) return false;
    return batch.multipleSubmissionsEnabled === true;
  },

  /*
  ==========================================
  Check if validity period is active
  Requirements: 7.1, 7.2
  
  @param {Object} batch - The batch object with validityFrom and validityUpto
  @returns {boolean} True if current date is within validity period
  ==========================================
  */
  isValidityPeriodActive(batch) {
    if (!batch) return false;

    const now = new Date();
    
    if (batch.validityFrom) {
      const fromDate = new Date(batch.validityFrom);
      if (now < fromDate) {
        return false;
      }
    }

    if (batch.validityUpto) {
      const uptoDate = new Date(batch.validityUpto);
      // Set time to end of day for validityUpto
      uptoDate.setHours(23, 59, 59, 999);
      if (now > uptoDate) {
        return false;
      }
    }

    return true;
  },
};

module.exports = BulkPassSchema;
