const { pool } = require("../dbconfig/db");

/**
 * Raw-SQL data layer for bulk_pass_parent_requests table.
 * Handles public website-initiated bulk pass requests that require General Administrator approval.
 * 
 * Requirements: 21.10, 24.2, 25.1
 */
const BulkPassParentRequest = {

  /*
  ==========================================
  Create a new parent request
  Requirements: 21.10
  ==========================================
  */
  async create(data) {
    const query = `
      INSERT INTO "bulk_pass_parent_requests" (
        "tracking_number",
        "shared_token",
        "company_name",
        "applicant_email",
        "applicant_mobile",
        "visitor_type",
        "no_of_persons",
        "no_of_vehicles",
        "payment_mode",
        "purpose",
        "validity_from",
        "validity_upto",
        "work_order_required",
        "ref_doc_no",
        "remarks",
        "token_active",
        "status",
        "created_at"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, NOW()
      )
      RETURNING *;
    `;

    const values = [
      data.tracking_number,
      data.shared_token,
      data.company_name,
      data.applicant_email,
      data.applicant_mobile,
      data.visitor_type,
      Number(data.no_of_persons) || 0,
      Number(data.no_of_vehicles) || 0,
      data.payment_mode || null,
      data.purpose || null,
      data.validity_from || null,
      data.validity_upto,
      data.work_order_required !== undefined ? !!data.work_order_required : false,
      data.ref_doc_no || null,
      data.remarks || null,
      data.token_active !== undefined ? !!data.token_active : false,
      data.status || "PENDING_ADMIN_APPROVAL",
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /*
  ==========================================
  Get parent request by ID
  Requirements: 24.2
  ==========================================
  */
  async getById(id) {
    const result = await pool.query(
      `SELECT
         id,
         tracking_number,
         shared_token,
         company_name,
         applicant_email,
         applicant_mobile,
         visitor_type,
         no_of_persons,
         no_of_vehicles,
         payment_mode,
         purpose,
         validity_from,
         validity_upto,
         work_order_required,
         ref_doc_no,
         remarks,
         token_active,
         approved_time_from,
         approved_time_upto,
         status,
         rejection_reason,
         created_at,
         approved_at,
         approved_by_user_id,
         rejected_at,
         rejected_by_user_id
       FROM "bulk_pass_parent_requests"
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /*
  ==========================================
  Get parent request by tracking number
  Requirements: 25.1
  ==========================================
  */
  async findByTrackingNumber(trackingNumber) {
    const result = await pool.query(
      `SELECT
         id,
         tracking_number,
         shared_token,
         company_name,
         applicant_email,
         applicant_mobile,
         visitor_type,
         no_of_persons,
         no_of_vehicles,
         payment_mode,
         purpose,
         validity_from,
         validity_upto,
         work_order_required,
         ref_doc_no,
         remarks,
         token_active,
         approved_time_from,
         approved_time_upto,
         status,
         rejection_reason,
         created_at,
         approved_at,
         approved_by_user_id,
         rejected_at,
         rejected_by_user_id
       FROM "bulk_pass_parent_requests"
       WHERE tracking_number = $1`,
      [trackingNumber]
    );
    return result.rows[0] || null;
  },

  /*
  ==========================================
  Get parent request by token
  Requirements: 25.1
  ==========================================
  */
  async findByToken(token) {
    const result = await pool.query(
      `SELECT
         id,
         tracking_number,
         shared_token,
         company_name,
         applicant_email,
         applicant_mobile,
         visitor_type,
         no_of_persons,
         no_of_vehicles,
         payment_mode,
         purpose,
         validity_from,
         validity_upto,
         work_order_required,
         ref_doc_no,
         remarks,
         token_active,
         approved_time_from,
         approved_time_upto,
         status,
         rejection_reason,
         created_at,
         approved_at,
         approved_by_user_id,
         rejected_at,
         rejected_by_user_id
       FROM "bulk_pass_parent_requests"
       WHERE shared_token = $1`,
      [token]
    );
    const row = result.rows[0] || null;
    
    // Enforce time-based validity: if the approved time window has elapsed,
    // treat the token as inactive
    if (row && row.approved_time_upto) {
      const uptoDate = new Date(row.approved_time_upto);
      if (uptoDate.getHours() === 0 && uptoDate.getMinutes() === 0 && uptoDate.getSeconds() === 0) {
        uptoDate.setHours(23, 59, 59, 999);
      }
      if (uptoDate.getTime() < Date.now()) {
        row.token_active = false;
      }
    }
    
    return row;
  },

  /*
  ==========================================
  Get all pending admin approval requests
  Requirements: 24.2
  ==========================================
  */
  async findPendingRequests(filters = {}) {
    const where = ['status = $1'];
    const params = ['PENDING_ADMIN_APPROVAL'];
    let i = 2;

    if (filters.applicant_email) {
      where.push(`applicant_email ILIKE $${i++}`);
      params.push(`%${filters.applicant_email}%`);
    }

    if (filters.company_name) {
      where.push(`company_name ILIKE $${i++}`);
      params.push(`%${filters.company_name}%`);
    }

    if (filters.from_date) {
      where.push(`created_at >= $${i++}`);
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      where.push(`created_at <= $${i++}`);
      params.push(`${filters.to_date} 23:59:59`);
    }

    const whereSql = where.join(" AND ");

    const query = `
      SELECT
        id,
        tracking_number,
        company_name,
        applicant_email,
        applicant_mobile,
        visitor_type,
        no_of_persons,
        no_of_vehicles,
        payment_mode,
        purpose,
        validity_from,
        validity_upto,
        work_order_required,
        ref_doc_no,
        remarks,
        status,
        created_at
      FROM "bulk_pass_parent_requests"
      WHERE ${whereSql}
      ORDER BY created_at ASC
      LIMIT 500
    `;

    const result = await pool.query(query, params);
    return result.rows;
  },

  /*
  ==========================================
  List parent requests with optional filters
  Requirements: 24.2
  ==========================================
  */
  async list(filters = {}) {
    const where = [];
    const params = [];
    let i = 1;

    if (filters.status) {
      where.push(`status = $${i++}`);
      params.push(filters.status);
    }

    if (filters.applicant_email) {
      where.push(`applicant_email ILIKE $${i++}`);
      params.push(`%${filters.applicant_email}%`);
    }

    if (filters.company_name) {
      where.push(`company_name ILIKE $${i++}`);
      params.push(`%${filters.company_name}%`);
    }

    if (filters.tracking_number) {
      where.push(`tracking_number ILIKE $${i++}`);
      params.push(`%${filters.tracking_number}%`);
    }

    // Combined search box: match against tracking number OR company name OR email
    if (filters.search) {
      where.push(`(tracking_number ILIKE $${i} OR company_name ILIKE $${i} OR applicant_email ILIKE $${i})`);
      params.push(`%${filters.search}%`);
      i++;
    }

    if (filters.from_date) {
      where.push(`created_at >= $${i++}`);
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      where.push(`created_at <= $${i++}`);
      params.push(`${filters.to_date} 23:59:59`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
      SELECT
        id,
        tracking_number,
        company_name,
        applicant_email,
        applicant_mobile,
        visitor_type,
        no_of_persons,
        no_of_vehicles,
        payment_mode,
        purpose,
        validity_from,
        validity_upto,
        work_order_required,
        ref_doc_no,
        remarks,
        status,
        rejection_reason,
        created_at,
        approved_at,
        approved_by_user_id,
        rejected_at,
        rejected_by_user_id
      FROM "bulk_pass_parent_requests"
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT 500
    `;

    const result = await pool.query(query, params);
    return result.rows;
  },

  /*
  ==========================================
  Update parent request
  Requirements: 24.2
  ==========================================
  */
  async update(id, data) {
    const allowedFields = [
      "company_name",
      "applicant_email",
      "applicant_mobile",
      "visitor_type",
      "no_of_persons",
      "no_of_vehicles",
      "payment_mode",
      "purpose",
      "validity_from",
      "validity_upto",
      "work_order_required",
      "ref_doc_no",
      "remarks",
      "token_active",
      "shared_token",
      "approved_time_from",
      "approved_time_upto",
      "status",
      "rejection_reason",
    ];

    const updates = [];
    const values = [id];
    let paramIndex = 2;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`"${field}" = $${paramIndex}`);
        
        if (field === "work_order_required" || field === "token_active") {
          values.push(!!data[field]);
        } else if (["no_of_persons", "no_of_vehicles"].includes(field)) {
          values.push(Number(data[field]));
        } else {
          values.push(data[field]);
        }
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    const query = `
      UPDATE "bulk_pass_parent_requests"
      SET ${updates.join(", ")}
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  },

  /*
  ==========================================
  Approve parent request
  Requirements: 24.2
  ==========================================
  */
  async approve(id, approvedByUserId, validityFrom, validityUpto) {
    const result = await pool.query(
      `UPDATE "bulk_pass_parent_requests"
       SET status = 'ACTIVE',
           token_active = true,
           approved_by_user_id = $2,
           approved_at = NOW(),
           approved_time_from = $3,
           approved_time_upto = $4
       WHERE id = $1
       RETURNING *`,
      [id, approvedByUserId, validityFrom, validityUpto]
    );
    return result.rows[0] || null;
  },

  /*
  ==========================================
  Reject parent request
  Requirements: 24.2
  ==========================================
  */
  async reject(id, rejectedByUserId, rejectionReason) {
    const result = await pool.query(
      `UPDATE "bulk_pass_parent_requests"
       SET status = 'REJECTED_BY_ADMIN',
           token_active = false,
           rejected_by_user_id = $2,
           rejected_at = NOW(),
           rejection_reason = $3
       WHERE id = $1
       RETURNING *`,
      [id, rejectedByUserId, rejectionReason]
    );
    return result.rows[0] || null;
  },

  /*
  ==========================================
  Check if request is expired based on approved_time_upto
  Instance method helper - Requirements: 25.1
  ==========================================
  */
  isExpired(parentRequest) {
    if (!parentRequest) return true;
    
    if (parentRequest.status !== 'ACTIVE') {
      return true;
    }

    if (!parentRequest.approved_time_upto) {
      return true;
    }

    const uptoDate = new Date(parentRequest.approved_time_upto);
    if (uptoDate.getHours() === 0 && uptoDate.getMinutes() === 0 && uptoDate.getSeconds() === 0) {
      uptoDate.setHours(23, 59, 59, 999);
    }
    return uptoDate.getTime() < Date.now();
  },

  /*
  ==========================================
  Check if request can accept submissions
  Instance method helper - Requirements: 25.1
  ==========================================
  */
  canSubmit(parentRequest) {
    if (!parentRequest) return false;
    
    if (parentRequest.status !== 'ACTIVE') {
      return false;
    }

    if (!parentRequest.token_active) {
      return false;
    }

    if (this.isExpired(parentRequest)) {
      return false;
    }

    // Check if current time is within approved time window
    const now = Date.now();
    
    if (parentRequest.approved_time_from) {
      const fromTime = new Date(parentRequest.approved_time_from).getTime();
      if (now < fromTime) {
        return false;
      }
    }

    if (parentRequest.approved_time_upto) {
      const uptoDate = new Date(parentRequest.approved_time_upto);
      if (uptoDate.getHours() === 0 && uptoDate.getMinutes() === 0 && uptoDate.getSeconds() === 0) {
        uptoDate.setHours(23, 59, 59, 999);
      }
      if (now > uptoDate.getTime()) {
        return false;
      }
    }

    return true;
  },

  /*
  ==========================================
  Validate email format
  Requirements: 21.10
  ==========================================
  */
  isValidEmail(email) {
    if (!email) return false;
    
    // RFC 5322 compliant email validation (simplified)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /*
  ==========================================
  Validate mobile format (10 digits)
  Requirements: 21.10
  ==========================================
  */
  isValidMobile(mobile) {
    if (!mobile) return false;
    
    const mobileRegex = /^\d{10}$/;
    return mobileRegex.test(mobile);
  },

  /*
  ==========================================
  Validate status enum
  Requirements: 21.10
  ==========================================
  */
  isValidStatus(status) {
    const validStatuses = [
      'PENDING_ADMIN_APPROVAL',
      'ACTIVE',
      'REJECTED_BY_ADMIN',
      'EXPIRED'
    ];
    return validStatuses.includes(status);
  },

  /*
  ==========================================
  Validate dates (from date before upto date)
  Requirements: 21.10
  ==========================================
  */
  isValidDateRange(validityFrom, validityUpto) {
    if (!validityUpto) return false;
    
    if (!validityFrom) return true; // validityFrom is optional
    
    const fromDate = new Date(validityFrom);
    const uptoDate = new Date(validityUpto);
    
    return fromDate.getTime() < uptoDate.getTime();
  },

  /*
  ==========================================
  Get child submissions count for parent request
  Requirements: 25.1
  ==========================================
  */
  async getChildSubmissionsCount(parentRequestId) {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM "bulk_pass_batches"
       WHERE parent_request_id = $1`,
      [parentRequestId]
    );
    return Number(result.rows[0]?.count) || 0;
  },

  /*
  ==========================================
  Get all child batches for parent request
  Requirements: 25.1
  ==========================================
  */
  async getChildBatches(parentRequestId) {
    const result = await pool.query(
      `SELECT
         b.id,
         b."refNo",
         b."submissionNumber",
         b.status,
         b."noOfPersons",
         b."noOfVehicles",
         b."createdAt",
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
       ORDER BY b."submissionNumber" ASC`,
      [parentRequestId]
    );
    return result.rows;
  },

  /*
  ==========================================
  Get next submission number for parent request
  Requirements: 25.1
  ==========================================
  */
  async getNextSubmissionNumber(parentRequestId) {
    const result = await pool.query(
      `SELECT COALESCE(MAX("submissionNumber"), 0) + 1 AS next_number
       FROM "bulk_pass_batches"
       WHERE parent_request_id = $1`,
      [parentRequestId]
    );
    return Number(result.rows[0]?.next_number) || 1;
  },

  /*
  ==========================================
  Check for duplicate request within time window
  Requirements: 21.10
  Allows up to maxSubmissions per email within hoursWindow.
  ==========================================
  */
  async hasDuplicateRequest(email, companyName, hoursWindow = 24, maxSubmissions = 10) {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM "bulk_pass_parent_requests"
       WHERE applicant_email = $1
         AND created_at >= NOW() - INTERVAL '${hoursWindow} hours'`,
      [email]
    );
    return Number(result.rows[0]?.count) >= maxSubmissions;
  },

  /*
  ==========================================
  Get requests by email for admin view
  Requirements: 24.2
  ==========================================
  */
  async findByEmail(email) {
    const result = await pool.query(
      `SELECT
         id,
         tracking_number,
         company_name,
         applicant_email,
         applicant_mobile,
         visitor_type,
         no_of_persons,
         no_of_vehicles,
         status,
         created_at,
         approved_at,
         rejected_at
       FROM "bulk_pass_parent_requests"
       WHERE applicant_email = $1
       ORDER BY created_at DESC`,
      [email]
    );
    return result.rows;
  },
};

module.exports = BulkPassParentRequest;
