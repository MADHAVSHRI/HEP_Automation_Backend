const { pool } = require("../dbconfig/db");
const ReferenceNumber = require("./referenceNumberSchema");

/**
 * Raw-SQL data layer for vendor_pass_requests, mirroring the style used in
 * passRequestSchema.js / userCreationSchema.js (the rest of the codebase
 * uses `pool.query` rather than Sequelize models at runtime).
 */
const VendorPassRequest = {
  async createIntake(data) {
    const query = `
      INSERT INTO "vendor_pass_requests" (
        "referenceNo",
        "token",
        "createdByUserId",
        "departmentId",
        "departmentName",
        "visitorTypeId",
        "visitorTypeOther",
        "purposeOfVisitId",
        "purposeOther",
        "passApplyMode",
        "companyName",
        "vendorEmail",
        "vendorMobile",
        "hasWorkOrder",
        "refDocNo",
        "workOrderFilePath",
        "workOrderFileName",
        "equipmentMaterialDetails",
        "remarks",
        "noOfPersonsAllowed",
        "noOfVehiclesAllowed",
        "paymentMode",
        "allowAuctionPassOnly",
        "validUpto",
        "status",
        "lastEmailSentAt",
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,NOW(),NOW()
      )
      RETURNING *;
    `;

    const values = [
      data.referenceNo,
      data.token,
      data.createdByUserId,
      data.departmentId,
      data.departmentName,
      data.visitorTypeId || null,
      data.visitorTypeOther || null,
      data.purposeOfVisitId || null,
      data.purposeOther || null,
      data.passApplyMode || "MULTIPLE",
      data.companyName,
      data.vendorEmail,
      data.vendorMobile,
      !!data.hasWorkOrder,
      data.refDocNo || null,
      data.workOrderFilePath || null,
      data.workOrderFileName || null,
      data.equipmentMaterialDetails || null,
      data.remarks || null,
      Number(data.noOfPersonsAllowed) || 0,
      Number(data.noOfVehiclesAllowed) || 0,
      data.paymentMode || "CASH",
      !!data.allowAuctionPassOnly,
      data.validUpto,
      data.status || "LINK_SENT",
      data.lastEmailSentAt || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async getById(id) {
    const result = await pool.query(
      `SELECT * FROM "vendor_pass_requests" WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async getByToken(token) {
    const result = await pool.query(
      `SELECT * FROM "vendor_pass_requests" WHERE "token" = $1`,
      [token]
    );
    return result.rows[0] || null;
  },

  /**
   * @param {Object} filters - { fromDate, toDate, companyName, createdByUserId, departmentId }
   * @returns rows with createdByUserName joined from users
   */
  async list(filters = {}) {
    const where = [];
    const params = [];
    let i = 1;

    if (filters.createdByUserId) {
      where.push(`v."createdByUserId" = $${i++}`);
      params.push(filters.createdByUserId);
    }
    if (filters.departmentId) {
      where.push(`v."departmentId" = $${i++}`);
      params.push(filters.departmentId);
    }
    if (filters.fromDate) {
      where.push(`v."createdAt" >= $${i++}`);
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      where.push(`v."createdAt" <= $${i++}`);
      params.push(`${filters.toDate} 23:59:59`);
    }
    if (filters.companyName) {
      where.push(`v."companyName" ILIKE $${i++}`);
      params.push(`%${filters.companyName}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
      SELECT
        v.*,
        u."userName" AS "createdByUserName"
      FROM "vendor_pass_requests" v
      LEFT JOIN "users" u ON u.id = v."createdByUserId"
      ${whereSql}
      ORDER BY v."createdAt" DESC
      LIMIT 500
    `;

    const result = await pool.query(query, params);
    return result.rows;
  },

  async updateStatus(id, status) {
    const result = await pool.query(
      `UPDATE "vendor_pass_requests"
         SET "status" = $1, "updatedAt" = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return result.rows[0] || null;
  },

  async markEmailSent(id) {
    const result = await pool.query(
      `UPDATE "vendor_pass_requests"
         SET "lastEmailSentAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  },

  async submitVendorForm(token, persons, vehicles) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Generate pass numbers for persons
      for (let i = 0; i < persons.length; i++) {
        const personPassNo = await ReferenceNumber.generatePersonPassNo(client);
        persons[i].personPassNo = personPassNo;
      }

      // Generate pass numbers for vehicles
      for (let i = 0; i < vehicles.length; i++) {
        const vehiclePassNo = await ReferenceNumber.generateVehiclePassNo(client);
        vehicles[i].vehiclePassNo = vehiclePassNo;
      }

      // Update vendor_pass_requests
      const result = await client.query(
        `UPDATE "vendor_pass_requests"
         SET "submittedPersons" = $1,
             "submittedVehicles" = $2,
             "status" = 'VENDOR_SUBMITTED',
             "submittedAt" = NOW(),
             "updatedAt" = NOW()
       WHERE "token" = $3
       RETURNING *`,
        [JSON.stringify(persons), JSON.stringify(vehicles), token]
      );

      await client.query("COMMIT");
      client.release();
      return result.rows[0] || null;
    } catch (error) {
      console.error("submitVendorForm error:", error);
      await client.query("ROLLBACK");
      client.release();
      throw error;
    }
  },

  async approveVendorPerson(vendorPassId, personIndex) {
    const result = await pool.query(
      `UPDATE "vendor_pass_requests"
       SET "submittedPersons" = jsonb_set(
         "submittedPersons",
         array[${personIndex}::text, 'status'],
         '"approved"'::jsonb
       ),
       "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [vendorPassId]
    );
    return result.rows[0] || null;
  },

  async rejectVendorPerson(vendorPassId, personIndex, rejectedReason) {
    const result = await pool.query(
      `UPDATE "vendor_pass_requests"
       SET "submittedPersons" = jsonb_set(
         jsonb_set(
           "submittedPersons",
           array[${personIndex}::text, 'status'],
           '"rejected"'::jsonb
         ),
         array[${personIndex}::text, 'rejectedReason'],
         $2::jsonb
       ),
       "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [vendorPassId, JSON.stringify(rejectedReason)]
    );
    return result.rows[0] || null;
  },

  async approveVendorVehicle(vendorPassId, vehicleIndex) {
    const result = await pool.query(
      `UPDATE "vendor_pass_requests"
       SET "submittedVehicles" = jsonb_set(
         "submittedVehicles",
         array[${vehicleIndex}::text, 'status'],
         '"approved"'::jsonb
       ),
       "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [vendorPassId]
    );
    return result.rows[0] || null;
  },

  async rejectVendorVehicle(vendorPassId, vehicleIndex, rejectedReason) {
    const result = await pool.query(
      `UPDATE "vendor_pass_requests"
       SET "submittedVehicles" = jsonb_set(
         jsonb_set(
           "submittedVehicles",
           array[${vehicleIndex}::text, 'status'],
           '"rejected"'::jsonb
         ),
         array[${vehicleIndex}::text, 'rejectedReason'],
         $2::jsonb
       ),
       "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [vendorPassId, JSON.stringify(rejectedReason)]
    );
    return result.rows[0] || null;
  },

  async completeVendorPassReview(vendorPassId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get current vendor pass
      const vendorRes = await client.query(
        `SELECT "submittedPersons", "submittedVehicles"
         FROM "vendor_pass_requests"
         WHERE id = $1`,
        [vendorPassId]
      );

      if (vendorRes.rows.length === 0) {
        throw new Error("Vendor pass request not found");
      }

      const { submittedPersons, submittedVehicles } = vendorRes.rows[0];
      const persons = Array.isArray(submittedPersons) ? submittedPersons : [];
      const vehicles = Array.isArray(submittedVehicles) ? submittedVehicles : [];

      // Check if all reviewed
      const allPersonsReviewed = persons.every(p => p.status === 'approved' || p.status === 'rejected');
      const allVehiclesReviewed = vehicles.every(v => v.status === 'approved' || v.status === 'rejected');

      if (!allPersonsReviewed || !allVehiclesReviewed) {
        throw new Error("All persons and vehicles must be reviewed before completing");
      }

      // Check if any approved (to determine final status)
      const hasApprovedPerson = persons.some(p => p.status === 'approved');
      const hasApprovedVehicle = vehicles.some(v => v.status === 'approved');

      const finalStatus = (hasApprovedPerson || hasApprovedVehicle) ? 'APPROVED' : 'REJECTED';

      const result = await client.query(
        `UPDATE "vendor_pass_requests"
         SET "status" = $1,
             "updatedAt" = NOW()
         WHERE id = $2
         RETURNING *`,
        [finalStatus, vendorPassId]
      );

      await client.query("COMMIT");
      client.release();
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      client.release();
      throw error;
    }
  },
};

module.exports = VendorPassRequest;
