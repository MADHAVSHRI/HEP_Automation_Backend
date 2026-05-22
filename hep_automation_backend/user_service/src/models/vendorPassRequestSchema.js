const { pool } = require("../dbconfig/db");
const ReferenceNumber = require("./referenceNumberSchema");
const axios = require("axios");

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || "http://localhost:5002";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

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

      // Ensure every person/vehicle has a status for traffic approver UI
      persons.forEach((p) => {
        if (!p.status) p.status = "pending";
      });
      vehicles.forEach((v) => {
        if (!v.status) v.status = "pending";
      });

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

      const vendorPass = result.rows[0];

      // Insert into vendor_pass_persons
      for (const p of persons) {
        await client.query(
          `INSERT INTO "vendor_pass_persons" (
            "vendorPassRequestId", "personPassNo", "name", "mobile", "aadharNo",
            "email", "nationality", "dateFrom", "dateTo",
            "photoFilePath", "photoFileName",
            "idProofFilePath", "idProofFileName",
            "aadharPDFFilePATH", "aadharPDFFileName",
            "passportPath", "passportName",
            "requisitionLetterPath", "requisitionLetterName",
            "driverLicensePath", "driverLicenseName",
            "policeVerificationPath", "policeVerificationName",
            "employmentProofPath", "employmentProofName",
            "chaLicensePath", "chaLicenseName",
            "passType", "passPeriod", "amount",
            "status", "createdAt", "updatedAt"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,NOW(),NOW())`,
          [
            vendorPass.id,
            p.personPassNo,
            p.personName || p.name || null,
            p.mobileNumber || p.mobile || null,
            p.aadharNumber || p.aadharNo || null,
            p.email || null,
            p.nationality || "INDIAN",
            p.dateFrom || null,
            p.dateTo || null,
            p.photoFilePath || null,
            p.photoFileName || null,
            p.idProofFilePath || null,
            p.idProofFileName || null,
            p.aadharPDFFilePATH || null,
            p.aadharPDFFileName || null,
            p.passportPath || null,
            p.passportName || null,
            p.requisitionLetterPath || null,
            p.requisitionLetterName || null,
            p.driverLicensePath || null,
            p.driverLicenseName || null,
            p.policeVerificationPath || null,
            p.policeVerificationName || null,
            p.employmentProofPath || null,
            p.employmentProofName || null,
            p.chaLicensePath || null,
            p.chaLicenseName || null,
            p.passType || null,
            p.passPeriod || null,
            p.amount || 0,
            "pending",
          ]
        );
      }

      // Insert into vendor_pass_vehicles
      for (const v of vehicles) {
        await client.query(
          `INSERT INTO "vendor_pass_vehicles" (
            "vendorPassRequestId", "vehiclePassNo", "vehicleRegistrationNo", "vehicleType",
            "dateFrom", "dateTo",
            "scannedCopyFilePath", "scannedCopyFileName",
            "insuranceFilePath", "insuranceFileName",
            "permitFilePath", "permitFileName",
            "fitnessFilePath", "fitnessFileName",
            "requestLetterPath", "requestLetterName",
            "taxFilePath", "taxFileName",
            "emissionFilePath", "emissionFileName",
            "passType", "passPeriod", "amount",
            "status", "createdAt", "updatedAt"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW(),NOW())`,
          [
            vendorPass.id,
            v.vehiclePassNo,
            v.vehicleRegistrationNo || v.registrationNo || v.regNo || null,
            v.vehicleType || null,
            v.dateFrom || null,
            v.dateTo || null,
            v.scannedCopyFilePath || null,
            v.scannedCopyFileName || null,
            v.insuranceFilePath || null,
            v.insuranceFileName || null,
            v.permitFilePath || null,
            v.permitFileName || null,
            v.fitnessFilePath || null,
            v.fitnessFileName || null,
            v.requestLetterPath || null,
            v.requestLetterName || null,
            v.taxFilePath || null,
            v.taxFileName || null,
            v.emissionFilePath || null,
            v.emissionFileName || null,
            v.passType || null,
            v.passPeriod || null,
            v.amount || 0,
            "pending",
          ]
        );
      }

      await client.query("COMMIT");
      client.release();
      return vendorPass || null;
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
    // Sync to vendor_pass_persons table
    await pool.query(
      `UPDATE "vendor_pass_persons" vpp
       SET "status" = 'approved', "updatedAt" = NOW()
       FROM "vendor_pass_requests" vpr
       WHERE vpr.id = $1
         AND vpp."vendorPassRequestId" = vpr.id
         AND vpp."personPassNo" = (vpr."submittedPersons"->${personIndex}->>'personPassNo')`,
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
    // Sync to vendor_pass_persons table
    await pool.query(
      `UPDATE "vendor_pass_persons" vpp
       SET "status" = 'rejected', "rejectedReason" = $2, "updatedAt" = NOW()
       FROM "vendor_pass_requests" vpr
       WHERE vpr.id = $1
         AND vpp."vendorPassRequestId" = vpr.id
         AND vpp."personPassNo" = (vpr."submittedPersons"->${personIndex}->>'personPassNo')`,
      [vendorPassId, rejectedReason]
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
    // Sync to vendor_pass_vehicles table
    await pool.query(
      `UPDATE "vendor_pass_vehicles" vpv
       SET "status" = 'approved', "updatedAt" = NOW()
       FROM "vendor_pass_requests" vpr
       WHERE vpr.id = $1
         AND vpv."vendorPassRequestId" = vpr.id
         AND vpv."vehiclePassNo" = (vpr."submittedVehicles"->${vehicleIndex}->>'vehiclePassNo')`,
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
    // Sync to vendor_pass_vehicles table
    await pool.query(
      `UPDATE "vendor_pass_vehicles" vpv
       SET "status" = 'rejected', "rejectedReason" = $2, "updatedAt" = NOW()
       FROM "vendor_pass_requests" vpr
       WHERE vpr.id = $1
         AND vpv."vendorPassRequestId" = vpr.id
         AND vpv."vehiclePassNo" = (vpr."submittedVehicles"->${vehicleIndex}->>'vehiclePassNo')`,
      [vendorPassId, rejectedReason]
    );
    return result.rows[0] || null;
  },

  async completeVendorPassReview(vendorPassId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get current vendor pass with all details needed for email
      const vendorRes = await client.query(
        `SELECT "submittedPersons", "submittedVehicles", "vendorEmail",
                "companyName", "referenceNo", "validUpto", "departmentName"
         FROM "vendor_pass_requests"
         WHERE id = $1`,
        [vendorPassId]
      );

      if (vendorRes.rows.length === 0) {
        throw new Error("Vendor pass request not found");
      }

      const row = vendorRes.rows[0];
      const submittedPersons = row.submittedPersons;
      const submittedVehicles = row.submittedVehicles;
      const persons = Array.isArray(submittedPersons) ? submittedPersons : [];
      const vehicles = Array.isArray(submittedVehicles) ? submittedVehicles : [];

      // Check if all reviewed
      const allPersonsReviewed = persons.every(p => p.status === 'approved' || p.status === 'rejected');
      const allVehiclesReviewed = vehicles.every(v => v.status === 'approved' || v.status === 'rejected');

      if (!allPersonsReviewed || !allVehiclesReviewed) {
        throw new Error("All persons and vehicles must be reviewed before completing");
      }

      // Check if any approved (to determine final status)
      const approvedPersons = persons.filter(p => p.status === 'approved');
      const approvedVehicles = vehicles.filter(v => v.status === 'approved');
      const hasApprovedPerson = approvedPersons.length > 0;
      const hasApprovedVehicle = approvedVehicles.length > 0;

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

      // Send approval email if approved
      if (finalStatus === 'APPROVED' && row.vendorEmail) {
        try {
          const qrLink = `${FRONTEND_URL}/vendor_pass_approved/${vendorPassId}`;

          await axios.post(`${EMAIL_SERVICE_URL}/api/email/sendVendorPassApproved`, {
            email: row.vendorEmail,
            companyName: row.companyName,
            referenceNo: row.referenceNo,
            qrLink: qrLink,
            approvedPersonsCount: approvedPersons.length,
            approvedVehiclesCount: approvedVehicles.length,
            validUpto: row.validUpto,
            departmentName: row.departmentName
          });

          console.log(`[VENDOR-PASS] Approval email sent to ${row.vendorEmail} for ${row.referenceNo}`);
        } catch (emailError) {
          // Log error but don't fail the approval
          console.error("[VENDOR-PASS] Failed to send approval email:", emailError.message);
        }
      }

      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      client.release();
      throw error;
    }
  },
};

module.exports = VendorPassRequest;
