const { pool } = require("../dbconfig/db");
const ReferenceNumber = require("./referenceNumberSchema");
const axios = require("axios");

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

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
    const {
      page = 1,
      limit = 20,
      offset = 0,
      fromDate,
      toDate,
      companyName,
      createdByUserId,
      departmentId,
    } = filters;

    const where = [];
    const params = [];
    let i = 1;

    if (createdByUserId) {
      where.push(`v."createdByUserId" = $${i++}`);
      params.push(createdByUserId);
    }
    if (departmentId) {
      where.push(`v."departmentId" = $${i++}`);
      params.push(departmentId);
    }
    if (fromDate) {
      where.push(`v."createdAt" >= $${i++}`);
      params.push(fromDate);
    }
    if (toDate) {
      where.push(`v."createdAt" <= $${i++}`);
      params.push(`${toDate} 23:59:59`);
    }
    if (companyName) {
      const searchParam = `%${companyName}%`;
      where.push(`(
        v."companyName" ILIKE $${i}
        OR v."referenceNo" ILIKE $${i}
        OR EXISTS (
          SELECT 1 FROM vendor_pass_persons vpp
          WHERE vpp."vendorPassRequestId" = v.id
            AND (vpp.name ILIKE $${i} OR vpp."aadharNo" ILIKE $${i})
        )
        OR EXISTS (
          SELECT 1 FROM vendor_pass_vehicles vpv
          WHERE vpv."vendorPassRequestId" = v.id
            AND vpv."vehicleRegistrationNo" ILIKE $${i}
        )
      )`);
      params.push(searchParam);
      i++;
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // ─── Query 1: Total counts for pagination ───
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM "vendor_pass_requests" v
      ${whereSql}
    `;
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0]?.total || 0);

    const counts = { total };

    if (total === 0) {
      return { data: [], counts };
    }

    // ─── Query 2: Paginated IDs ───
    const idParams = [...params, limit, offset];
    const idQuery = `
      SELECT v.id
      FROM "vendor_pass_requests" v
      ${whereSql}
      ORDER BY v."createdAt" DESC
      LIMIT $${i} OFFSET $${i + 1}
    `;
    const idRes = await pool.query(idQuery, idParams);
    const passIds = idRes.rows.map((r) => r.id);

    if (passIds.length === 0) {
      return { data: [], counts };
    }

    // ─── Query 3: Detail Hydration ───
    const placeholders = passIds.map((_, idx) => `$${idx + 1}`).join(",");
    const detailQuery = `
      SELECT
        v.*,
        u."userName" AS "createdByUserName",
        COALESCE(p.person_count, 0) AS "personApplied",
        COALESCE(p.person_approved, 0) AS "personApproved",
        COALESCE(p.person_rejected, 0) AS "personRejected",
        COALESCE(veh.vehicle_count, 0) AS "vehicleApplied",
        COALESCE(veh.vehicle_approved, 0) AS "vehicleApproved",
        COALESCE(veh.vehicle_rejected, 0) AS "vehicleRejected"
      FROM "vendor_pass_requests" v
      LEFT JOIN "users" u ON u.id = v."createdByUserId"
      LEFT JOIN (
        SELECT
          "vendorPassRequestId",
          COUNT(*) AS person_count,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) AS person_approved,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS person_rejected
        FROM vendor_pass_persons
        GROUP BY "vendorPassRequestId"
      ) p ON p."vendorPassRequestId" = v.id
      LEFT JOIN (
        SELECT
          "vendorPassRequestId",
          COUNT(*) AS vehicle_count,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) AS vehicle_approved,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS vehicle_rejected
        FROM vendor_pass_vehicles
        GROUP BY "vendorPassRequestId"
      ) veh ON veh."vendorPassRequestId" = v.id
      WHERE v.id IN (${placeholders})
      ORDER BY v."createdAt" DESC
    `;
    const detailRes = await pool.query(detailQuery, passIds);

    return { data: detailRes.rows, counts };
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

      // Helper to check if access area is Oil Dock
      const isOilDockArea = (areaId) => {
        const area = String(areaId || "").toUpperCase();
        return area === "1" || area.includes("OIL JETTY") || area.includes("OIL_JETTY");
      };

      const hasOilDockEntity = [
        ...(persons || []),
        ...(vehicles || [])
      ].some(entity => isOilDockArea(entity.accessAreaId || entity.accessArea));

      let initialWorkflowState = "PENDING_PASS_SECTION";
      
      const hasMonthlyYearlyVehicle = (vehicles || []).some(v => 
        ["MONTHLY", "YEARLY", "ANNUAL"].includes(v.passType)
      );
      
      const hasOilDockVehicle = (vehicles || []).some(v => 
        isOilDockArea(v.accessAreaId || v.accessArea)
      );
      
      const hasOilDockPerson = (persons || []).some(p => 
        isOilDockArea(p.accessAreaId || p.accessArea)
      );
      
      // SRS routing for vendor passes (re-aligned to match agent routing logic):
      if (hasMonthlyYearlyVehicle) {
        initialWorkflowState = "PENDING_SAFETY";
      } else if (hasOilDockVehicle) {
        initialWorkflowState = "PENDING_FIRE_SAFETY";
      } else if (hasOilDockPerson) {
        initialWorkflowState = "PENDING_SR_DTM";
      }

      // Fetch the original request details
      const origRes = await client.query(
        `SELECT * FROM "vendor_pass_requests" WHERE "token" = $1`,
        [token]
      );
      const originalRequest = origRes.rows[0];
      if (!originalRequest) {
        throw new Error("Vendor intake request not found for the given token");
      }

      // Update the original vendor_pass_request
      const result = await client.query(
        `UPDATE "vendor_pass_requests"
         SET "status" = 'VENDOR_SUBMITTED',
             "isOilDock" = $2,
             "workflowState" = $3,
             "submittedAt" = NOW(),
             "updatedAt" = NOW()
       WHERE "token" = $1
       RETURNING *`,
        [token, hasOilDockEntity, initialWorkflowState]
      );
      const currentVendorPass = result.rows[0];

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
            "status", "createdAt", "updatedAt",
            "rateId", "hepTypeId", "designationId", "designationOther",
            "idProofType", "idProofNumber", "countryId", "accessAreaId",
            "passportNo", "cdcNumber", "seafarerPassFor", "seafarerIdType",
            "withTwoWheeler", "vehicleNo", "cdcDocumentPath", "cdcDocumentName",
            "declarationFormPath", "declarationFormName",
            "entryAuthorizationFilePath", "entryAuthorizationFileName"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,NOW(),NOW(),$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51)`,
          [
            currentVendorPass.id,
            p.personPassNo,
            p.name,
            p.mobile || null,
            p.aadharNo || null,
            p.email || null,
            p.nationality || null,
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
            p.rateId != null ? Number(p.rateId) : null,
            p.hepTypeId != null ? Number(p.hepTypeId) : null,
            p.designationId != null ? Number(p.designationId) : null,
            p.designationOther || null,
            p.idProofType || null,
            p.idProofNumber || null,
            p.countryId != null ? Number(p.countryId) : null,
            p.accessAreaId || (p.accessArea || null),
            p.passportNo || null,
            p.cdcNumber || null,
            p.seafarerPassFor || null,
            p.seafarerIdType || null,
            p.withTwoWheeler === true || p.withTwoWheeler === "true",
            p.vehicleNo || null,
            p.cdcDocumentPath || null,
            p.cdcDocumentName || null,
            p.declarationFormPath || null,
            p.declarationFormName || null,
            p.entryAuthorizationFilePath || null,
            p.entryAuthorizationFileName || null,
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
            "status", "createdAt", "updatedAt",
            "rateId", "vehicleTypeId", "fuelType", "insuranceExpiry", "rcValidity", "accessAreaId",
            "sparkArresterFilePath", "sparkArresterFileName",
            "twistLockFilePath", "twistLockFileName"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW(),NOW(),$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)`,
          [
            currentVendorPass.id,
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
            v.rateId != null ? Number(v.rateId) : null,
            v.vehicleTypeId != null ? Number(v.vehicleTypeId) : (v.type != null ? Number(v.type) : null),
            v.fuelType || null,
            v.insuranceExpiry || null,
            v.rcValidity || null,
            v.accessAreaId || (v.accessArea || null),
            v.sparkArresterFilePath || null,
            v.sparkArresterFileName || null,
            v.twistLockFilePath || null,
            v.twistLockFileName || null,
          ]
        );
      }

      await client.query("COMMIT");
      client.release();
      return currentVendorPass || null;
    } catch (error) {
      console.error("submitVendorForm error:", error);
      await client.query("ROLLBACK");
      client.release();
      throw error;
    }
  },

  async approveVendorPerson(vendorPassId, personIndex) {
    const personRes = await pool.query(
      `SELECT id FROM "vendor_pass_persons" WHERE "vendorPassRequestId" = $1 ORDER BY id ASC`,
      [vendorPassId]
    );
    const person = personRes.rows[personIndex];
    if (!person) return null;

    await pool.query(
      `UPDATE "vendor_pass_persons"
       SET "status" = 'approved', "updatedAt" = NOW()
       WHERE id = $1`,
      [person.id]
    );

    const result = await pool.query(
      `SELECT * FROM "vendor_pass_requests" WHERE id = $1`,
      [vendorPassId]
    );
    return result.rows[0] || null;
  },

  async rejectVendorPerson(vendorPassId, personIndex, rejectedReason) {
    const personRes = await pool.query(
      `SELECT id FROM "vendor_pass_persons" WHERE "vendorPassRequestId" = $1 ORDER BY id ASC`,
      [vendorPassId]
    );
    const person = personRes.rows[personIndex];
    if (!person) return null;

    await pool.query(
      `UPDATE "vendor_pass_persons"
       SET "status" = 'rejected', "rejectedReason" = $2, "updatedAt" = NOW()
       WHERE id = $1`,
      [person.id, rejectedReason]
    );

    const result = await pool.query(
      `SELECT * FROM "vendor_pass_requests" WHERE id = $1`,
      [vendorPassId]
    );
    return result.rows[0] || null;
  },

  async approveVendorVehicle(vendorPassId, vehicleIndex) {
    const vehicleRes = await pool.query(
      `SELECT id FROM "vendor_pass_vehicles" WHERE "vendorPassRequestId" = $1 ORDER BY id ASC`,
      [vendorPassId]
    );
    const vehicle = vehicleRes.rows[vehicleIndex];
    if (!vehicle) return null;

    await pool.query(
      `UPDATE "vendor_pass_vehicles"
       SET "status" = 'approved', "updatedAt" = NOW()
       WHERE id = $1`,
      [vehicle.id]
    );

    const result = await pool.query(
      `SELECT * FROM "vendor_pass_requests" WHERE id = $1`,
      [vendorPassId]
    );
    return result.rows[0] || null;
  },

  async revertVendorPerson(vendorPassId, personIndex, revertReason) {
    const personRes = await pool.query(
      `SELECT id FROM "vendor_pass_persons" WHERE "vendorPassRequestId" = $1 ORDER BY id ASC`,
      [vendorPassId]
    );
    const person = personRes.rows[personIndex];
    if (!person) return null;

    await pool.query(
      `UPDATE "vendor_pass_persons"
       SET "status" = 'reverted', "revertReason" = $2, "isReverted" = true, "lastRevertReason" = $2, "updatedAt" = NOW()
       WHERE id = $1`,
      [person.id, revertReason]
    );

    const result = await pool.query(
      `SELECT * FROM "vendor_pass_requests" WHERE id = $1`,
      [vendorPassId]
    );
    return result.rows[0] || null;
  },

  async updateVendorPerson(vendorPassId, personIndex, updatedData) {
    const personRes = await pool.query(
      `SELECT id, "personPassNo" FROM "vendor_pass_persons" WHERE "vendorPassRequestId" = $1 ORDER BY id ASC`,
      [vendorPassId]
    );
    const person = personRes.rows[personIndex];
    if (!person) throw new Error("Person not found");

    const allowedFields = [
      'name', 'mobile', 'email', 'aadharNo', 'nationality', 'dateFrom', 'dateTo',
      'photoFilePath', 'photoFileName', 'idProofFilePath', 'idProofFileName',
      'aadharPDFFilePATH', 'aadharPDFFileName', 'passportPath', 'passportName',
      'requisitionLetterPath', 'requisitionLetterName', 'driverLicensePath', 'driverLicenseName',
      'policeVerificationPath', 'policeVerificationName', 'employmentProofPath', 'employmentProofName',
      'chaLicensePath', 'chaLicenseName', 'passType', 'passPeriod', 'amount',
      'rateId', 'hepTypeId', 'designationId', 'designationOther', 'idProofType', 'idProofNumber',
      'countryId', 'accessAreaId', 'cardNumber', 'visaNo', 'passportNo', 'cdcNumber',
      'seafarerPassFor', 'seafarerIdType', 'withTwoWheeler', 'vehicleNo', 'cdcDocumentPath',
      'cdcDocumentName', 'declarationFormPath', 'declarationFormName',
      'entryAuthorizationFilePath', 'entryAuthorizationFileName'
    ];

    const updates = ['"updatedAt" = NOW()'];
    const values = [person.id];
    let paramIndex = 2;

    for (const field of allowedFields) {
      if (updatedData[field] !== undefined) {
        updates.push(`"${field}" = $${paramIndex}`);
        if (field === 'withTwoWheeler') {
          values.push(updatedData[field] === true || updatedData[field] === 'true');
        } else if (['rateId', 'hepTypeId', 'designationId', 'countryId', 'passPeriod'].includes(field)) {
          values.push(updatedData[field] != null ? Number(updatedData[field]) : null);
        } else if (field === 'amount') {
          values.push(updatedData[field] != null ? updatedData[field] : null);
        } else if (field === 'passType' && updatedData[field] === 'ANNUAL') {
          values.push('YEARLY');
        } else {
          values.push(updatedData[field]);
        }
        paramIndex++;
      }
    }

    const query = `UPDATE "vendor_pass_persons" SET ${updates.join(', ')} WHERE id = $1`;
    await pool.query(query, values);
    return true;
  },

  async updateVendorVehicle(vendorPassId, vehicleIndex, updatedData) {
    const vehicleRes = await pool.query(
      `SELECT * FROM "vendor_pass_vehicles" WHERE "vendorPassRequestId" = $1 ORDER BY id ASC`,
      [vendorPassId]
    );
    const vehicle = vehicleRes.rows[vehicleIndex];
    if (!vehicle) throw new Error("Vehicle not found");

    const allowedFields = [
      'vehicleRegistrationNo', 'vehicleType', 'dateFrom', 'dateTo',
      'scannedCopyFilePath', 'scannedCopyFileName', 'insuranceFilePath', 'insuranceFileName',
      'permitFilePath', 'permitFileName', 'fitnessFilePath', 'fitnessFileName',
      'requestLetterPath', 'requestLetterName', 'taxFilePath', 'taxFileName',
      'emissionFilePath', 'emissionFileName', 'passType', 'passPeriod', 'amount',
      'rateId', 'vehicleTypeId', 'fuelType', 'insuranceExpiry', 'rcValidity', 'accessAreaId',
      'sparkArresterFilePath', 'sparkArresterFileName', 'twistLockFilePath', 'twistLockFileName'
    ];

    // Handle mapping registrationNo -> vehicleRegistrationNo
    if (updatedData.registrationNo !== undefined && updatedData.vehicleRegistrationNo === undefined) {
      updatedData.vehicleRegistrationNo = updatedData.registrationNo;
    }

    const updateFields = {};

    for (const field of allowedFields) {
      if (updatedData[field] !== undefined) {
        let val;
        if (['rateId', 'vehicleTypeId', 'passPeriod'].includes(field)) {
          val = updatedData[field] != null ? Number(updatedData[field]) : null;
        } else if (field === 'amount') {
          val = updatedData[field] != null ? updatedData[field] : null;
        } else if (field === 'passType' && updatedData[field] === 'ANNUAL') {
          val = 'YEARLY';
        } else {
          val = updatedData[field];
        }
        updateFields[field] = val;
      }
    }

    const updatedPassType = updatedData.passType !== undefined ? updatedData.passType : vehicle.passType;
    const normalizedPassType = updatedPassType === 'ANNUAL' ? 'YEARLY' : (updatedPassType || '');
    const updatedAccessArea = String(updatedData.accessAreaId !== undefined ? updatedData.accessAreaId : (vehicle.accessAreaId || '')).toUpperCase();
    const isOilDock = updatedAccessArea === '1' || updatedAccessArea.includes('OIL JETTY') || updatedAccessArea.includes('OIL_JETTY');
    const isMonthlyYearly = ['MONTHLY', 'YEARLY', 'ANNUAL'].includes(normalizedPassType) || ['2', '3'].includes(String(updatedData.passPeriod !== undefined ? updatedData.passPeriod : vehicle.passPeriod));

    // If pass type is DAILY (not monthly/yearly), twist lock is not needed
    if (normalizedPassType === 'DAILY' || (!isMonthlyYearly && normalizedPassType)) {
      updateFields['twistLockFilePath'] = null;
      updateFields['twistLockFileName'] = null;
      updateFields['twistLockCertified'] = false;
      updateFields['twistLockRemarks'] = null;
    }

    // If access area is NOT Oil Dock, spark arrester is not needed
    if (!isOilDock && updatedAccessArea) {
      updateFields['sparkArresterFilePath'] = null;
      updateFields['sparkArresterFileName'] = null;
      updateFields['sparkArresterCertified'] = false;
      updateFields['sparkArresterRemarks'] = null;
      updateFields['srDtmApproved'] = false;
      updateFields['srDtmRemarks'] = null;
    }

    // Invalidation logic: if files changed or config changed, reset certifications
    const newTwistLockUploaded = updatedData.twistLockFilePath !== undefined && updatedData.twistLockFilePath !== vehicle.twistLockFilePath;
    const passTypeChangedToMonthlyYearly = isMonthlyYearly && !(['MONTHLY', 'YEARLY', 'ANNUAL'].includes(vehicle.passType) || ['2', '3'].includes(String(vehicle.passPeriod)));
    if (newTwistLockUploaded || passTypeChangedToMonthlyYearly) {
      updateFields['twistLockCertified'] = false;
      updateFields['twistLockRemarks'] = null;
    }

    const newSparkArresterUploaded = updatedData.sparkArresterFilePath !== undefined && updatedData.sparkArresterFilePath !== vehicle.sparkArresterFilePath;
    const existingArea = String(vehicle.accessAreaId || '').toUpperCase();
    const existingIsOilDock = existingArea === '1' || existingArea.includes('OIL JETTY') || existingArea.includes('OIL_JETTY');
    const accessAreaChangedToOilDock = isOilDock && !existingIsOilDock;
    if (newSparkArresterUploaded || accessAreaChangedToOilDock) {
      updateFields['sparkArresterCertified'] = false;
      updateFields['sparkArresterRemarks'] = null;
      updateFields['srDtmApproved'] = false;
      updateFields['srDtmRemarks'] = null;
    }

    const updates = ['"updatedAt" = NOW()'];
    const values = [vehicle.id];
    let paramIndex = 2;

    for (const [field, val] of Object.entries(updateFields)) {
      updates.push(`"${field}" = $${paramIndex}`);
      values.push(val);
      paramIndex++;
    }

    const query = `UPDATE "vendor_pass_vehicles" SET ${updates.join(', ')} WHERE id = $1`;
    await pool.query(query, values);
    return true;
  },

  async resubmitRevertedVendorPass(vendorPassId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Fetch all persons and vehicles for this vendor pass request to determine workflowState
      const personsRes = await client.query(
        `SELECT "accessAreaId" FROM "vendor_pass_persons" WHERE "vendorPassRequestId" = $1`,
        [vendorPassId]
      );
      const vehiclesRes = await client.query(
        `SELECT "accessAreaId", "passType" FROM "vendor_pass_vehicles" WHERE "vendorPassRequestId" = $1`,
        [vendorPassId]
      );

      const isPersonOilDock = personsRes.rows.some(p => {
        const area = String(p.accessAreaId || "").toUpperCase();
        return area === "1" || area.includes("OIL JETTY") || area.includes("OIL_JETTY");
      });
      const isVehicleOilDock = vehiclesRes.rows.some(v => {
        const area = String(v.accessAreaId || "").toUpperCase();
        return area === "1" || area.includes("OIL JETTY") || area.includes("OIL_JETTY");
      });
      const isOilDock = isPersonOilDock || isVehicleOilDock;

      const hasMonthlyYearlyVehicle = vehiclesRes.rows.some(v => v.passType === "MONTHLY" || v.passType === "YEARLY" || v.passType === "ANNUAL");
      const hasAnyVehicle = vehiclesRes.rows.length > 0;

      let workflowState = "PENDING_PASS_SECTION";
      if (hasMonthlyYearlyVehicle) {
        workflowState = "PENDING_SAFETY";
      } else if (isVehicleOilDock) {
        workflowState = "PENDING_FIRE_SAFETY";
      } else if (isPersonOilDock) {
        workflowState = "PENDING_SR_DTM";
      }

      // Reset status to 'pending' and unconditionally clear approval/certification flags for all non-rejected entities
      // to ensure a full re-evaluation through the workflow queues upon resubmission.
      await client.query(
        `UPDATE "vendor_pass_persons" 
         SET status = 'pending', 
             "srDtmApproved" = false, 
             "srDtmRemarks" = null, 
             "isReverted" = false,
             "updatedAt" = NOW()
         WHERE "vendorPassRequestId" = $1 AND status != 'rejected'`,
        [vendorPassId]
      );

      await client.query(
        `UPDATE "vendor_pass_vehicles" 
         SET status = 'pending', 
             "twistLockCertified" = false, 
             "twistLockRemarks" = null, 
             "sparkArresterCertified" = false, 
             "sparkArresterRemarks" = null, 
             "srDtmApproved" = false, 
             "srDtmRemarks" = null, 
             "isReverted" = false,
             "updatedAt" = NOW()
         WHERE "vendorPassRequestId" = $1 AND status != 'rejected'`,
        [vendorPassId]
      );

      await client.query(
        `UPDATE "vendor_pass_requests" 
         SET status = 'VENDOR_SUBMITTED', "isOilDock" = $2, "workflowState" = $3, "updatedAt" = NOW() 
         WHERE id = $1`,
        [vendorPassId, isOilDock, workflowState]
      );

      await client.query("COMMIT");
      client.release();
      return true;
    } catch (e) {
      await client.query("ROLLBACK");
      client.release();
      throw e;
    }
  },


  async revertVendorVehicle(vendorPassId, vehicleIndex, revertReason) {
    const vehicleRes = await pool.query(
      `SELECT id FROM "vendor_pass_vehicles" WHERE "vendorPassRequestId" = $1 ORDER BY id ASC`,
      [vendorPassId]
    );
    const vehicle = vehicleRes.rows[vehicleIndex];
    if (!vehicle) return null;

    await pool.query(
      `UPDATE "vendor_pass_vehicles"
       SET "status" = 'reverted', "revertReason" = $2, "isReverted" = true, "lastRevertReason" = $2, "updatedAt" = NOW()
       WHERE id = $1`,
      [vehicle.id, revertReason]
    );

    const result = await pool.query(
      `SELECT * FROM "vendor_pass_requests" WHERE id = $1`,
      [vendorPassId]
    );
    return result.rows[0] || null;
  },

  async rejectVendorVehicle(vendorPassId, vehicleIndex, rejectedReason) {
    const vehicleRes = await pool.query(
      `SELECT id FROM "vendor_pass_vehicles" WHERE "vendorPassRequestId" = $1 ORDER BY id ASC`,
      [vendorPassId]
    );
    const vehicle = vehicleRes.rows[vehicleIndex];
    if (!vehicle) return null;

    await pool.query(
      `UPDATE "vendor_pass_vehicles"
       SET "status" = 'rejected', "rejectedReason" = $2, "updatedAt" = NOW()
       WHERE id = $1`,
      [vehicle.id, rejectedReason]
    );

    const result = await pool.query(
      `SELECT * FROM "vendor_pass_requests" WHERE id = $1`,
      [vendorPassId]
    );
    return result.rows[0] || null;
  },

  async completeVendorPassReview(vendorPassId, approvedByUserId, role, roleId = null) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Run independent queries in parallel for better performance
      const [vendorRes, personsRes, vehiclesRes] = await Promise.all([
        client.query(
          `SELECT "vendorEmail", "companyName", "referenceNo", "validUpto", "departmentName", "token"
           FROM "vendor_pass_requests"
           WHERE id = $1`,
          [vendorPassId]
        ),
        client.query(
          `SELECT id, status, "srDtmApproved" FROM "vendor_pass_persons" WHERE "vendorPassRequestId" = $1`,
          [vendorPassId]
        ),
        client.query(
          `SELECT id, status, "passType", "twistLockCertified", "sparkArresterCertified" FROM "vendor_pass_vehicles" WHERE "vendorPassRequestId" = $1`,
          [vendorPassId]
        ),
      ]);

      if (vendorRes.rows.length === 0) {
        throw new Error("Vendor pass request not found");
      }

      const row = vendorRes.rows[0];
      const persons = personsRes.rows;
      const vehicles = vehiclesRes.rows;

      // Check if any reverted entities
      const hasRevertedPerson = persons.some(p => p.status === 'reverted');
      const hasRevertedVehicle = vehicles.some(v => v.status === 'reverted');
      const isReverted = hasRevertedPerson || hasRevertedVehicle;

      let approvedBy = null;
      if (approvedByUserId) {
        try {
          const userRes = await client.query('SELECT "userName" FROM "users" WHERE id = $1', [approvedByUserId]);
          if (userRes.rows.length > 0) {
            approvedBy = userRes.rows[0].userName;
          }
        } catch (userErr) {
          console.error("Error looking up vendor pass approver user details:", userErr);
        }
      }

      if (isReverted) {
        const result = await client.query(
          `UPDATE "vendor_pass_requests"
           SET "status" = 'REVERTED',
               "approvedBy" = $2,
               "updatedAt" = NOW()
           WHERE id = $1
           RETURNING *`,
          [vendorPassId, approvedBy]
        );
        await client.query("COMMIT");
        client.release();

        // Send email to vendor with link to update reverted entities
        if (row.vendorEmail && EMAIL_SERVICE_URL) {
          try {
            const { encryptToken } = require("../utils/cryptoUtils");
            const encryptedToken = encryptToken(row.token);
            const formLink = `${FRONTEND_URL}/vendor_pass_approved/${encryptedToken}`;

            // Build list of reverted entities
            const revertedPersonsList = persons.filter(p => p.status === 'reverted');
            const revertedVehiclesList = vehicles.filter(v => v.status === 'reverted');

            // Fetch reverted entity names and reasons
            const revertedEntities = [];
            if (revertedPersonsList.length > 0) {
              const personDetails = await client.query(
                `SELECT id, name, "revertReason" FROM "vendor_pass_persons" WHERE id = ANY($1)`,
                [revertedPersonsList.map(p => p.id)]
              );
              personDetails.rows.forEach(p => {
                revertedEntities.push({
                  type: 'person',
                  name: p.name || `Person ${p.id}`,
                  reason: p.revertReason || 'Correction required'
                });
              });
            }
            if (revertedVehiclesList.length > 0) {
              const vehicleDetails = await client.query(
                `SELECT id, "vehicleRegistrationNo", "revertReason" FROM "vendor_pass_vehicles" WHERE id = ANY($1)`,
                [revertedVehiclesList.map(v => v.id)]
              );
              vehicleDetails.rows.forEach(v => {
                revertedEntities.push({
                  type: 'vehicle',
                  name: v.vehicleRegistrationNo || `Vehicle ${v.id}`,
                  reason: v.revertReason || 'Correction required'
                });
              });
            }

            axios.post(`${EMAIL_SERVICE_URL}/api/email/sendPassReverted`, {
              email: row.vendorEmail,
              name: row.companyName,
              referenceNumber: row.referenceNo,
              revertedEntities: revertedEntities,
              revertedCount: revertedEntities.length,
              formLink: formLink
            }, {
              headers: { "x-service-name": "USER-SERVICE" },
              timeout: 8000
            }).then(() => {
              console.log(`[VENDOR-PASS] Revert email sent to ${row.vendorEmail} for ${row.referenceNo}`);
            }).catch((emailErr) => {
              console.error(`[VENDOR-PASS] Failed to send revert email:`, emailErr.message);
            });
          } catch (emailErr) {
            console.error(`[VENDOR-PASS] Failed to trigger revert email:`, emailErr.message);
          }
        }

        return {
          ...result.rows[0],
          reviewStatus: 'REVERTED',
          message: 'Review saved. Vendor pass request has reverted entities that need correction.'
        };
      }

      const isSafety = roleId === 26 || role === "Safety Officer";
      const isFireSafety = roleId === 27 || role === "Fire Safety Officer";
      const isSrDtm = roleId === 28 || role === "Senior Deputy Traffic Manager";

      const isOilDockArea = (val) => {
        if (!val) return false;
        const str = String(val).toUpperCase();
        return str === "1" || str.includes("OIL JETTY") || str.includes("OIL_JETTY");
      };

      if (isSafety) {
        const uncertifiedVehicles = vehicles.filter(v => 
          v.status !== 'rejected' && 
          (v.passType === 'MONTHLY' || v.passType === 'YEARLY') && 
          !v.twistLockCertified
        );
        if (uncertifiedVehicles.length > 0) {
          throw new Error("All monthly/yearly vehicles must be certified by the Safety Officer.");
        }

        const prRes = await client.query(`SELECT "isOilDock" FROM "vendor_pass_requests" WHERE id = $1`, [vendorPassId]);
        const isOilDock = prRes.rows[0]?.isOilDock;
        const nextState = isOilDock ? 'PENDING_FIRE_SAFETY' : 'PENDING_PASS_SECTION';

        // Reset entity statuses to 'pending' when entering Pass Section queue
        if (nextState === 'PENDING_PASS_SECTION') {
          await client.query(`
            UPDATE "vendor_pass_persons" SET status = 'pending', "updatedAt" = NOW()
            WHERE "vendorPassRequestId" = $1 AND status = 'approved'
          `, [vendorPassId]);
          await client.query(`
            UPDATE "vendor_pass_vehicles" SET status = 'pending', "updatedAt" = NOW()
            WHERE "vendorPassRequestId" = $1 AND status = 'approved'
          `, [vendorPassId]);
        }

        const result = await client.query(`
          UPDATE "vendor_pass_requests"
          SET "workflowState" = $2, "approvedBy" = $3, "updatedAt" = NOW()
          WHERE id = $1
          RETURNING *
        `, [vendorPassId, nextState, approvedBy]);
        await client.query("COMMIT");
        client.release();
        return {
          ...result.rows[0],
          reviewStatus: 'PENDING_NEXT',
          message: 'Safety Officer pre-approval completed.'
        };
      }

      if (isFireSafety) {
        const oilDockVehicles = vehicles.filter(v => isOilDockArea(v.accessAreaId));
        const uncertifiedVehicles = oilDockVehicles.filter(v => 
          v.status !== 'rejected' && 
          !v.sparkArresterCertified
        );
        if (uncertifiedVehicles.length > 0) {
          throw new Error("All vehicles must be certified by the Fire Safety Officer.");
        }

        const result = await client.query(`
          UPDATE "vendor_pass_requests"
          SET "workflowState" = 'PENDING_SR_DTM', "approvedBy" = $2, "updatedAt" = NOW()
          WHERE id = $1
          RETURNING *
        `, [vendorPassId, approvedBy]);
        await client.query("COMMIT");
        client.release();
        return {
          ...result.rows[0],
          reviewStatus: 'PENDING_NEXT',
          message: 'Fire Safety Officer pre-approval completed.'
        };
      }

      if (isSrDtm) {
        const oilDockPersons = persons.filter(p => isOilDockArea(p.accessAreaId));
        const unapprovedPersons = oilDockPersons.filter(p => 
          p.status !== 'rejected' && 
          !p.srDtmApproved
        );
        if (unapprovedPersons.length > 0) {
          throw new Error("All persons must be approved by the Senior Deputy Traffic Manager.");
        }

        const oilDockVehicles = vehicles.filter(v => isOilDockArea(v.accessAreaId));
        const unapprovedVehicles = oilDockVehicles.filter(v => 
          !['approved', 'rejected', 'reverted'].includes(v.status)
        );
        if (unapprovedVehicles.length > 0) {
          throw new Error("All vehicles must be approved by the Senior Deputy Traffic Manager.");
        }

        // Reset entity statuses to 'pending' when entering Pass Section queue
        await client.query(`
          UPDATE "vendor_pass_persons" SET status = 'pending', "updatedAt" = NOW()
          WHERE "vendorPassRequestId" = $1 AND status = 'approved'
        `, [vendorPassId]);
        await client.query(`
          UPDATE "vendor_pass_vehicles" SET status = 'pending', "updatedAt" = NOW()
          WHERE "vendorPassRequestId" = $1 AND status = 'approved'
        `, [vendorPassId]);

        const result = await client.query(`
          UPDATE "vendor_pass_requests"
          SET "workflowState" = 'PENDING_PASS_SECTION', "approvedBy" = $2, "updatedAt" = NOW()
          WHERE id = $1
          RETURNING *
        `, [vendorPassId, approvedBy]);
        await client.query("COMMIT");
        client.release();
        return {
          ...result.rows[0],
          reviewStatus: 'PENDING_NEXT',
          message: 'Senior Deputy Traffic Manager pre-approval completed.'
        };
      }

      // Check if all reviewed
      const allPersonsReviewed = persons.every(p => ['approved', 'rejected', 'reverted'].includes(p.status));
      const allVehiclesReviewed = vehicles.every(v => ['approved', 'rejected', 'reverted'].includes(v.status));
      const allReviewed = allPersonsReviewed && allVehiclesReviewed;

      let finalStatus = 'VENDOR_SUBMITTED';
      if (allReviewed) {
        finalStatus = 'COMPLETED';
      }

      const result = await client.query(
        `UPDATE "vendor_pass_requests"
         SET "status" = $1,
             "approvedBy" = $2,
             "updatedAt" = NOW()
         WHERE id = $3
         RETURNING *`,
        [finalStatus, approvedBy, vendorPassId]
      );

      await client.query("COMMIT");
      client.release();

      // Send email if COMPLETED, APPROVED, or REVERTED
      if (['APPROVED', 'COMPLETED', 'REVERTED'].includes(finalStatus) && row.vendorEmail) {
        try {
          const approvedPersons = persons.filter(p => p.status === 'approved');
          const approvedVehicles = vehicles.filter(v => v.status === 'approved');
          const { encryptToken } = require("../utils/cryptoUtils");
          const encryptedToken = encryptToken(row.token);
          const qrLink = finalStatus === 'REVERTED' 
            ? `${FRONTEND_URL}/vendor_pass/${encryptedToken}`
            : `${FRONTEND_URL}/vendor_pass_approved/${encryptedToken}`;

          const formatValidUpto = (raw) => {
            if (!raw) return null;
            try {
              const d = new Date(raw);
              if (isNaN(d)) return String(raw);
              return d.toLocaleString("en-IN", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit", hour12: true,
                timeZone: "Asia/Kolkata",
              });
            } catch { return String(raw); }
          };

          axios.post(`${EMAIL_SERVICE_URL}/api/email/sendVendorPassApproved`, {
            email: row.vendorEmail,
            companyName: row.companyName,
            referenceNo: row.referenceNo,
            qrLink: qrLink,
            approvedPersonsCount: approvedPersons.length,
            approvedVehiclesCount: approvedVehicles.length,
            validUpto: formatValidUpto(row.validUpto),
            departmentName: row.departmentName,
            finalStatus: finalStatus
          }, {
            headers: { "x-service-name": "USER-SERVICE" },
            timeout: 8000
          }).then(() => {
            console.log(`[VENDOR-PASS] ${finalStatus} email sent to ${row.vendorEmail} for ${row.referenceNo}`);
          }).catch((emailError) => {
            console.error(`[VENDOR-PASS] Failed to send ${finalStatus} email:`, emailError.message);
          });
        } catch (emailErr) {
          console.error(`[VENDOR-PASS] Failed to trigger email:`, emailErr.message);
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
