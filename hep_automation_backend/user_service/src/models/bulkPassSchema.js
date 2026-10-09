const { pool } = require("../dbconfig/db");
const { getValidityState, normalizeValidityFrom } = require("../utils/bulkPassValidity");

/**
 * Who created each batch and who approved it, by name. Creation is
 * "createdByUserId"; approval is the latest COMPLETED entry in the status log
 * (written by the traffic officer who finalised the batch). `reviewedByName`
 * is the officer who last approved a person in it — the pass PDF is rendered
 * just before the COMPLETED log entry exists, so it falls back to this.
 * Mutates and returns `rows`; one query for any number of rows.
 */
async function attachActors(rows) {
  const list = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
  if (!list.length) return rows;
  const ids = list.map((r) => r.id);
  const result = await pool.query(
    `SELECT b.id,
            cu."userName" AS "createdByName",
            ap."approvedByName",
            ap."approvedAt",
            rv."reviewedByName"
       FROM "bulk_pass_batches" b
       LEFT JOIN "users" cu ON cu.id = b."createdByUserId"
       LEFT JOIN LATERAL (
         SELECT au."userName" AS "approvedByName", l."createdAt" AS "approvedAt"
           FROM "bulk_pass_status_logs" l
           LEFT JOIN "users" au ON au.id = l."changedBy"
          WHERE l."batchId" = b.id AND l.status = 'COMPLETED'
          ORDER BY l."createdAt" DESC
          LIMIT 1
       ) ap ON true
       LEFT JOIN LATERAL (
         SELECT ru."userName" AS "reviewedByName"
           FROM "bulk_pass_persons" bp
           JOIN "users" ru ON ru.id = bp."approvedBy"
          WHERE bp."batchId" = b.id AND bp."approvalStatus" = 'APPROVED'
          ORDER BY bp."approvedAt" DESC NULLS LAST
          LIMIT 1
       ) rv ON true
      WHERE b.id = ANY($1::int[])`,
    [ids]
  );
  const byId = new Map(result.rows.map((r) => [r.id, r]));
  for (const row of list) {
    const a = byId.get(row.id) || {};
    row.createdByName = a.createdByName || null;
    row.approvedByName = a.approvedByName || null;
    row.approvedAt = a.approvedAt || null;
    row.reviewedByName = a.reviewedByName || null;
  }
  return rows;
}

/**
 * The person/vehicle ceilings live in the maxNoOf* columns, but the whole
 * module — controllers, emails, the API contract — knows them as noOfPersons /
 * noOfVehicles. Queries that use RETURNING * pass through here so callers only
 * ever see the API field names.
 */
function withApiFieldNames(row) {
  if (!row) return row;
  if (row.maxNoOfPersons !== undefined) row.noOfPersons = row.maxNoOfPersons;
  if (row.maxNoOfVehicles !== undefined) row.noOfVehicles = row.maxNoOfVehicles;
  return row;
}

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
        "workOrderFilePath",
        "workOrderFileName",
        "maxNoOfPersons",
        "maxNoOfVehicles",
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
        "maxSubmissions",
        "maxTotalPersons",
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
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
      data.workOrderFilePath || null,
      data.workOrderFileName || null,
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
      // null means "no cumulative limit" — the behaviour of every pass issued
      // before these columns existed.
      data.maxSubmissions === undefined || data.maxSubmissions === null || data.maxSubmissions === ""
        ? null
        : Number(data.maxSubmissions),
      data.maxTotalPersons === undefined || data.maxTotalPersons === null || data.maxTotalPersons === ""
        ? null
        : Number(data.maxTotalPersons),
    ];

    const sanitizedValues = values.map((v) => (v === undefined ? null : v));
    const result = await pool.query(query, sanitizedValues);
    return withApiFieldNames(result.rows[0]);
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
         "workOrderFilePath",
         "workOrderFileName",
         "maxNoOfPersons"  AS "noOfPersons",
         "maxNoOfVehicles" AS "noOfVehicles",
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
         "maxSubmissions",
         "maxTotalPersons",
         "expiryReminderSentAt",
         "createdAt",
         "updatedAt"
       FROM "bulk_pass_batches"
       WHERE id = $1`,
      [id]
    );
    const row = result.rows[0] || null;
    if (row) await attachActors(row);
    return row;
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
         "workOrderFilePath",
         "workOrderFileName",
         "maxNoOfPersons"  AS "noOfPersons",
         "maxNoOfVehicles" AS "noOfVehicles",
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
         "maxSubmissions",
         "maxTotalPersons",
         "expiryReminderSentAt",
         "createdAt",
         "updatedAt"
       FROM "bulk_pass_batches"
       WHERE "token" = $1`,
      [token]
    );
    const row = result.rows[0] || null;
    // Enforce time-based link expiry: if the link's window has elapsed, treat
    // the token as inactive so every applicant-facing flow rejects it.
    // `tokenActiveRaw` preserves the stored flag so callers that need to tell
    // "expired by time" apart from "deactivated after submission" still can —
    // a multi-submission Bulk Pass must keep serving its history once expired.
    if (row) {
      row.tokenActiveRaw = row.tokenActive;
      row.tokenExpiredByTime = !!(
        row.tokenExpiresAt && new Date(row.tokenExpiresAt).getTime() < Date.now()
      );
      if (row.tokenExpiredByTime) row.tokenActive = false;
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
    // Combined search box. Callers most often have whatever the applicant gave
    // them on the phone — an email address or a mobile number — so those are
    // searchable alongside the reference number and company name.
    if (filters.search) {
      where.push(
        `(b."refNo" ILIKE $${i} OR b."companyName" ILIKE $${i} OR b."applicantEmail" ILIKE $${i} OR b."applicantMobile" ILIKE $${i})`
      );
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
    if (filters.requestSource) {
      where.push(`b."request_source" = $${i++}`);
      params.push(filters.requestSource);
    }
    // Bulk Pass level view: only the containers (a department intake or a
    // stand-alone single-submission batch), never the child batches that sit
    // inside a multi-submission Bulk Pass.
    if (filters.excludeChildSubmissions) {
      where.push(`b."parent_request_id" IS NULL`);
    }
    // The mirror image: only the individual batch submissions.
    if (filters.onlyChildSubmissions) {
      where.push(`b."parent_request_id" IS NOT NULL`);
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
        b."maxNoOfPersons"  AS "noOfPersons",
        b."maxNoOfVehicles" AS "noOfVehicles",
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
        b."applicantEmail",
        b."applicantMobile",
        b."tokenActive",
        b."tokenExpiresAt",
        b."submittedAt",
        b."createdAt",
        b."updatedAt",
        b."multipleSubmissionsEnabled",
        b."parent_request_id" AS "parentRequestId",
        b."submission_number" AS "submissionNumber",
        b."request_source"    AS "requestSource",
        b."maxSubmissions",
        b."maxTotalPersons",
        COALESCE(p.person_count, 0) AS "submittedPersonsCount",
        COALESCE(p.vehicle_count, 0) AS "submittedVehiclesCount",
        COALESCE(c.child_count, 0) AS "childSubmissionsCount",
        COALESCE(c.child_persons, 0) AS "childPersonsCount",
        COALESCE(c.child_vehicles, 0) AS "childVehiclesCount",
        c.last_submission_at AS "lastSubmissionAt"
      FROM "bulk_pass_batches" b
      LEFT JOIN (
        SELECT
          "batchId",
          COUNT(CASE WHEN "vehicleNumber" IS NULL OR "vehicleNumber" = '' THEN 1 END) AS person_count,
          COUNT(CASE WHEN "vehicleNumber" IS NOT NULL AND "vehicleNumber" != '' THEN 1 END) AS vehicle_count
        FROM "bulk_pass_persons"
        GROUP BY "batchId"
      ) p ON p."batchId" = b.id
      LEFT JOIN (
        SELECT
          cb.parent_request_id AS parent_id,
          COUNT(DISTINCT cb.id) AS child_count,
          COUNT(cp.id) FILTER (WHERE cp."vehicleNumber" IS NULL OR cp."vehicleNumber" = '') AS child_persons,
          COUNT(cp.id) FILTER (WHERE cp."vehicleNumber" IS NOT NULL AND cp."vehicleNumber" != '') AS child_vehicles,
          MAX(cb."createdAt") AS last_submission_at
        FROM "bulk_pass_batches" cb
        LEFT JOIN "bulk_pass_persons" cp ON cp."batchId" = cb.id
        WHERE cb.parent_request_id IS NOT NULL
        GROUP BY cb.parent_request_id
      ) c ON c.parent_id = b.id
      ${whereSql}
      ORDER BY b."createdAt" DESC
      LIMIT 500
    `;

    const result = await pool.query(query, params);
    await attachActors(result.rows);
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
        b."maxNoOfPersons"  AS "noOfPersons",
        b."maxNoOfVehicles" AS "noOfVehicles",
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
        b."submittedAt",
        b."parent_request_id" AS "parentRequestId",
        b."submission_number" AS "submissionNumber",
        b."createdAt",
        b."updatedAt",
        -- How long this batch has been waiting, so the queue can show its age
        -- rather than only the order it happens to be sorted in.
        EXTRACT(EPOCH FROM (NOW() - COALESCE(b."submittedAt", b."createdAt"))) AS "waitingSeconds",
        COALESCE(p.person_count, 0) AS "submittedPersonsCount",
        COALESCE(p.vehicle_count, 0) AS "submittedVehiclesCount",
        COALESCE(p.pending_count, 0) AS "pendingReviewCount"
      FROM "bulk_pass_batches" b
      LEFT JOIN (
        SELECT
          "batchId",
          COUNT(CASE WHEN "vehicleNumber" IS NULL OR "vehicleNumber" = '' THEN 1 END) AS person_count,
          COUNT(CASE WHEN "vehicleNumber" IS NOT NULL AND "vehicleNumber" != '' THEN 1 END) AS vehicle_count,
          COUNT(CASE WHEN COALESCE("approvalStatus", 'PENDING') = 'PENDING' THEN 1 END) AS pending_count
        FROM "bulk_pass_persons"
        GROUP BY "batchId"
      ) p ON p."batchId" = b.id
      WHERE b."status" = 'UNDER_REVIEW'
      ORDER BY b."createdAt" ASC
      LIMIT 500
    `;
    const result = await pool.query(query);
    await attachActors(result.rows);
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
      "maxSubmissions",
      "maxTotalPersons",
      "paymentMode",
      "purpose",
      "validityFrom",
      "validityUpto",
      "remarks",
    ];

    // The person/vehicle ceilings are stored as maxNoOf* columns; callers still
    // pass them by their API names.
    const COLUMN_FOR = {
      noOfPersons: "maxNoOfPersons",
      noOfVehicles: "maxNoOfVehicles",
    };

    const updates = ['"updatedAt" = NOW()'];
    const values = [id];
    let paramIndex = 2;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`"${COLUMN_FOR[field] || field}" = $${paramIndex}`);
        if (field === "workOrderRequired") {
          values.push(!!data[field]);
        } else if (["noOfPersons", "noOfVehicles"].includes(field)) {
          values.push(Number(data[field]));
        } else if (["maxSubmissions", "maxTotalPersons"].includes(field)) {
          // Blank clears the limit rather than writing an invalid integer.
          values.push(data[field] === "" || data[field] === null ? null : Number(data[field]));
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
    return withApiFieldNames(result.rows[0]) || null;
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
    return withApiFieldNames(result.rows[0]) || null;
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
    // Vehicles live in this table too and carry a driver, documents and a
    // blacklist history of their own. They used to be excluded here, which meant
    // they never reached APPROVED — and since QR generation only receives
    // approved rows, no vehicle pass was ever produced. Counting them makes the
    // review cover everything that will appear on the printed pass.
    const isVehicle = `("vehicleNumber" IS NOT NULL AND "vehicleNumber" <> '')`;
    const result = await pool.query(
      `SELECT
         COUNT(*)                                                                   AS total,
         COUNT(*) FILTER (WHERE COALESCE("approvalStatus", 'PENDING') = 'PENDING')  AS pending,
         COUNT(*) FILTER (WHERE "approvalStatus" = 'APPROVED')                      AS approved,
         COUNT(*) FILTER (WHERE "approvalStatus" = 'REJECTED')                      AS rejected,
         COUNT(*) FILTER (WHERE NOT ${isVehicle})                                   AS person_total,
         COUNT(*) FILTER (WHERE NOT ${isVehicle} AND COALESCE("approvalStatus", 'PENDING') = 'PENDING') AS person_pending,
         COUNT(*) FILTER (WHERE ${isVehicle})                                       AS vehicle_total,
         COUNT(*) FILTER (WHERE ${isVehicle} AND COALESCE("approvalStatus", 'PENDING') = 'PENDING')     AS vehicle_pending
       FROM "bulk_pass_persons"
       WHERE "batchId" = $1`,
      [batchId]
    );
    const row = result.rows[0];
    return {
      total:    Number(row.total),
      pending:  Number(row.pending),
      approved: Number(row.approved),
      rejected: Number(row.rejected),
      persons:  { total: Number(row.person_total),  pending: Number(row.person_pending) },
      vehicles: { total: Number(row.vehicle_total), pending: Number(row.vehicle_pending) },
    };
  },

  /*
  ==========================================
  Approve every row still awaiting a decision in a batch.
  Reviewing thirty people one click at a time is the single biggest cost in the
  traffic queue; anything already rejected is deliberately left alone.
  ==========================================
  */
  async approveAllPending(batchId, approvedBy) {
    const result = await pool.query(
      `UPDATE "bulk_pass_persons"
       SET "approvalStatus" = 'APPROVED',
           "approvalReason" = NULL,
           "approvedBy"     = $2,
           "approvedAt"     = NOW()
       WHERE "batchId" = $1
         AND COALESCE("approvalStatus", 'PENDING') = 'PENDING'
       RETURNING id`,
      [batchId, approvedBy || null]
    );
    return result.rowCount;
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

    // The person rows table stores people and vehicles side by side; a row with
    // a vehicleNumber is a vehicle, everything else is a person. Counting them
    // separately here means every caller (applicant history, management view,
    // summary tiles) reports the same numbers.
    const query = `
      SELECT
        b.id,
        b."refNo",
        b."submission_number",
        b."submission_number" AS "submissionNumber",
        b."request_source"    AS "requestSource",
        b."parent_request_id" AS "parentRequestId",
        b.status,
        b."maxNoOfPersons"  AS "noOfPersons",
        b."maxNoOfVehicles" AS "noOfVehicles",
        b."returnReason",
        b."rejectionReason",
        b."qrPdfPath",
        b."validityFrom",
        b."validityUpto",
        b."submittedAt",
        b."createdAt",
        b."updatedAt",
        COALESCE(p.person_count, 0)  AS "submittedPersonsCount",
        COALESCE(p.vehicle_count, 0) AS "submittedVehiclesCount",
        COALESCE(p.person_count, 0)  AS "personsCount",
        COALESCE(p.vehicle_count, 0) AS "vehiclesCount",
        COALESCE(p.approved_count, 0) AS "approvedPersonsCount",
        COALESCE(p.rejected_count, 0) AS "rejectedPersonsCount",
        COALESCE(p.pending_count, 0)  AS "pendingPersonsCount",
        COALESCE(p.approved_vehicle_count, 0) AS "approvedVehiclesCount",
        COALESCE(p.rejected_vehicle_count, 0) AS "rejectedVehiclesCount"
      FROM "bulk_pass_batches" b
      LEFT JOIN (
        SELECT
          "batchId",
          COUNT(CASE WHEN "vehicleNumber" IS NULL OR "vehicleNumber" = '' THEN 1 END) AS person_count,
          COUNT(CASE WHEN "vehicleNumber" IS NOT NULL AND "vehicleNumber" != '' THEN 1 END) AS vehicle_count,
          COUNT(CASE WHEN ("vehicleNumber" IS NULL OR "vehicleNumber" = '') AND "approvalStatus" = 'APPROVED' THEN 1 END) AS approved_count,
          COUNT(CASE WHEN ("vehicleNumber" IS NULL OR "vehicleNumber" = '') AND "approvalStatus" = 'REJECTED' THEN 1 END) AS rejected_count,
          COUNT(CASE WHEN ("vehicleNumber" IS NULL OR "vehicleNumber" = '') AND COALESCE("approvalStatus", 'PENDING') = 'PENDING' THEN 1 END) AS pending_count,
          COUNT(CASE WHEN ("vehicleNumber" IS NOT NULL AND "vehicleNumber" != '') AND "approvalStatus" = 'APPROVED' THEN 1 END) AS approved_vehicle_count,
          COUNT(CASE WHEN ("vehicleNumber" IS NOT NULL AND "vehicleNumber" != '') AND "approvalStatus" = 'REJECTED' THEN 1 END) AS rejected_vehicle_count
        FROM "bulk_pass_persons"
        GROUP BY "batchId"
      ) p ON p."batchId" = b.id
      WHERE b.parent_request_id = $1
      ${sourceFilter}
      ORDER BY b."submission_number" ASC, b."createdAt" ASC
    `;

    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
      ...row,
      submissionNumber: Number(row.submissionNumber) || Number(row.submission_number) || null,
      personsCount: Number(row.personsCount) || 0,
      vehiclesCount: Number(row.vehiclesCount) || 0,
      submittedPersonsCount: Number(row.submittedPersonsCount) || 0,
      submittedVehiclesCount: Number(row.submittedVehiclesCount) || 0,
      approvedPersonsCount: Number(row.approvedPersonsCount) || 0,
      rejectedPersonsCount: Number(row.rejectedPersonsCount) || 0,
      pendingPersonsCount: Number(row.pendingPersonsCount) || 0,
      approvedVehiclesCount: Number(row.approvedVehiclesCount) || 0,
      rejectedVehiclesCount: Number(row.rejectedVehiclesCount) || 0,
      // Whether the approved pass can be downloaded for this batch.
      passAvailable: row.status === "COMPLETED" && !!row.qrPdfPath,
    }));
  },

  /*
  ==========================================
  Aggregate submission statistics for one Bulk Pass (parent batch or parent
  request). Powers the applicant summary strip, the management view and the
  cumulative budget check.

  Two families of numbers come back:

    total*    — everything the applicant has ever sent through the link
                (history, "what did they submit").
    counted*  — what the Bulk Pass budget is charged for, for persons and
                for vehicles alike. A person the officer
                rejected, or a batch rejected as a whole, hands its place back
                to the applicant so the same people can be sent again. Rows
                still awaiting review stay counted: they hold their place until
                the officer decides.

  @param {number} parentId
  @param {string|null} source - 'DEPARTMENT' | 'PUBLIC_WEBSITE' | null (any)
  @param {{ excludeBatchId?: number|null }} options - leave one batch out of
         every figure; used when that batch is being revised and its rows are
         about to be replaced.
  @returns {Object} {
    totalSubmissions, totalPersons, totalVehicles,
    countedSubmissions, countedPersons,
    approvedPersons, pendingPersons, rejectedPersons,
    byStatus, lastSubmissionAt
  }
  ==========================================
  */
  async getSubmissionSummary(parentId, source = null, { excludeBatchId = null } = {}) {
    const params = [parentId];
    let i = 2;

    let sourceFilter = "";
    if (source) {
      sourceFilter = `AND b."request_source" = $${i++}`;
      params.push(source);
    }

    let excludeFilter = "";
    if (excludeBatchId) {
      excludeFilter = `AND b.id <> $${i++}`;
      params.push(excludeBatchId);
    }

    const isPerson = `(p."vehicleNumber" IS NULL OR p."vehicleNumber" = '')`;
    const isVehicle = `(p."vehicleNumber" IS NOT NULL AND p."vehicleNumber" != '')`;
    const batchLive = `b.status <> 'REJECTED'`;
    const rowStatus = `COALESCE(p."approvalStatus", 'PENDING')`;

    const result = await pool.query(
      `SELECT
         COUNT(DISTINCT b.id)                                                   AS total_submissions,
         COUNT(DISTINCT b.id) FILTER (WHERE ${batchLive})                       AS counted_submissions,
         COUNT(p.id) FILTER (WHERE ${isPerson})                                 AS total_persons,
         COUNT(p.id) FILTER (WHERE ${isVehicle})                                AS total_vehicles,
         COUNT(p.id) FILTER (WHERE ${isPerson} AND ${batchLive} AND ${rowStatus} <> 'REJECTED')  AS counted_persons,
         COUNT(p.id) FILTER (WHERE ${isPerson} AND ${batchLive} AND ${rowStatus} = 'APPROVED')   AS approved_persons,
         COUNT(p.id) FILTER (WHERE ${isPerson} AND ${batchLive} AND ${rowStatus} = 'PENDING')    AS pending_persons,
         COUNT(p.id) FILTER (WHERE ${isPerson} AND (NOT ${batchLive} OR ${rowStatus} = 'REJECTED')) AS rejected_persons,
         COUNT(p.id) FILTER (WHERE ${isVehicle} AND ${batchLive} AND ${rowStatus} <> 'REJECTED') AS counted_vehicles,
         COUNT(p.id) FILTER (WHERE ${isVehicle} AND ${batchLive} AND ${rowStatus} = 'APPROVED')  AS approved_vehicles,
         COUNT(p.id) FILTER (WHERE ${isVehicle} AND ${batchLive} AND ${rowStatus} = 'PENDING')   AS pending_vehicles,
         COUNT(p.id) FILTER (WHERE ${isVehicle} AND (NOT ${batchLive} OR ${rowStatus} = 'REJECTED')) AS rejected_vehicles,
         COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'UNDER_REVIEW')          AS under_review,
         COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'COMPLETED')             AS completed,
         COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'REJECTED')              AS rejected,
         COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'RETURNED_TO_APPLICANT') AS returned,
         MAX(b."createdAt")                                                     AS last_submission_at
       FROM "bulk_pass_batches" b
       LEFT JOIN "bulk_pass_persons" p ON p."batchId" = b.id
       WHERE b.parent_request_id = $1
       ${sourceFilter}
       ${excludeFilter}`,
      params
    );

    const row = result.rows[0] || {};
    const n = (v) => Number(v) || 0;
    return {
      totalSubmissions: n(row.total_submissions),
      totalPersons: n(row.total_persons),
      totalVehicles: n(row.total_vehicles),
      countedSubmissions: n(row.counted_submissions),
      countedPersons: n(row.counted_persons),
      approvedPersons: n(row.approved_persons),
      pendingPersons: n(row.pending_persons),
      rejectedPersons: n(row.rejected_persons),
      countedVehicles: n(row.counted_vehicles),
      approvedVehicles: n(row.approved_vehicles),
      pendingVehicles: n(row.pending_vehicles),
      rejectedVehicles: n(row.rejected_vehicles),
      byStatus: {
        underReview: n(row.under_review),
        completed: n(row.completed),
        rejected: n(row.rejected),
        returned: n(row.returned),
      },
      lastSubmissionAt: row.last_submission_at || null,
    };
  },

  /*
  ==========================================
  Bulk Passes whose validity window closes within `days` and which have not
  been sent an expiry reminder yet. Drives the daily reminder job.
  ==========================================
  */
  async findBulkPassesNearingExpiry(days = 3) {
    const result = await pool.query(
      `SELECT
         b.id,
         b."refNo",
         b."companyName",
         b."applicantEmail",
         b."validityFrom",
         b."validityUpto",
         b."token",
         b."maxSubmissions",
         b."maxTotalPersons",
         COALESCE(c.child_count, 0) AS "submissionsCount"
       FROM "bulk_pass_batches" b
       LEFT JOIN (
         SELECT parent_request_id AS parent_id, COUNT(*) AS child_count
         FROM "bulk_pass_batches"
         WHERE parent_request_id IS NOT NULL
         GROUP BY parent_request_id
       ) c ON c.parent_id = b.id
       WHERE b."multipleSubmissionsEnabled" = true
         AND b.parent_request_id IS NULL
         AND b."tokenActive" = true
         AND b."expiryReminderSentAt" IS NULL
         AND b."validityUpto" IS NOT NULL
         AND b."validityUpto" > NOW()
         AND b."validityUpto" <= NOW() + ($1 || ' days')::interval
       ORDER BY b."validityUpto" ASC
       LIMIT 200`,
      [String(days)]
    );
    return result.rows;
  },

  async setTokenActive(batchId, active) {
    const result = await pool.query(
      `UPDATE "bulk_pass_batches"
       SET "tokenActive" = $2, "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [batchId, !!active]
    );
    return withApiFieldNames(result.rows[0]) || null;
  },

  /*
  ==========================================
  Stamp the one-time expiry reminder on a Bulk Pass.
  ==========================================
  */
  async markExpiryReminderSent(batchId) {
    await pool.query(
      `UPDATE "bulk_pass_batches" SET "expiryReminderSentAt" = NOW() WHERE id = $1`,
      [batchId]
    );
  },

  /*
  ==========================================
  Fetch one child submission, scoped to its parent.
  Used by the applicant portal so a submission can only ever be opened through
  the Bulk Pass link it belongs to.
  ==========================================
  */
  async getChildBatchById(parentId, childId) {
    const result = await pool.query(
      `SELECT *
       FROM "bulk_pass_batches"
       WHERE id = $1 AND parent_request_id = $2`,
      [childId, parentId]
    );
    return withApiFieldNames(result.rows[0]) || null;
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
    // No end date means no upper bound here; otherwise the shared IST rules.
    if (!batch.validityUpto) {
      const from = normalizeValidityFrom(batch.validityFrom);
      return !from || Date.now() >= from.getTime();
    }
    return getValidityState(batch).canSubmit;
  },
};

module.exports = BulkPassSchema;
