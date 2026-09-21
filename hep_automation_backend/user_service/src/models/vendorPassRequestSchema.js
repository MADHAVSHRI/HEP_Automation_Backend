const { pool } = require("../dbconfig/db");
const ReferenceNumber = require("./referenceNumberSchema");
const axios = require("axios");

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL;
const FRONTEND_URL =
  process.env.FRONTEND_BASE_URL ||
  process.env.FRONTEND_URL ||
  "http://localhost:3000";

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
      `SELECT
         id,
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
         remarks,
         "noOfPersonsAllowed",
         "noOfVehiclesAllowed",
         "paymentMode",
         "allowAuctionPassOnly",
         "validUpto",
         status,
         "lastEmailSentAt",
         "createdAt",
         "updatedAt",
         "approvedBy"
       FROM "vendor_pass_requests"
       WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async getByToken(token) {
    const result = await pool.query(
      `SELECT
         id,
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
         remarks,
         "noOfPersonsAllowed",
         "noOfVehiclesAllowed",
         "paymentMode",
         "allowAuctionPassOnly",
         "validUpto",
         status,
         "lastEmailSentAt",
         "createdAt",
         "updatedAt",
         "approvedBy"
       FROM "vendor_pass_requests"
       WHERE "token" = $1`,
      [token],
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
      [status, id],
    );
    return result.rows[0] || null;
  },

  async markEmailSent(id) {
    const result = await pool.query(
      `UPDATE "vendor_pass_requests"
         SET "lastEmailSentAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
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
        const vehiclePassNo =
          await ReferenceNumber.generateVehiclePassNo(client);
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
        return (
          area === "1" ||
          area.includes("OIL JETTY") ||
          area.includes("OIL_JETTY")
        );
      };

      // const hasOilDockEntity = [...(persons || []), ...(vehicles || [])].some(
      //   (entity) => isOilDockArea(entity.accessAreaId || entity.accessArea),
      // );

      let initialWorkflowState = "PENDING_PASS_SECTION";

      const hasMonthlyYearlyVehicle = (vehicles || []).some((v) =>
        ["MONTHLY", "YEARLY", "ANNUAL"].includes(v.passType),
      );
      const trailerTypeRes = await client.query(`
        SELECT id
        FROM vehicle_types
        WHERE UPPER(TRIM(name)) IN ('TRAILORS', 'TRAILER LORRY')
      `);

      const trailerTypeIds = trailerTypeRes.rows.map((row) => Number(row.id));

      const hasAnnualTrailerVehicle = (vehicles || []).some((v) => {
        const passType = String(v.passType || "")
          .trim()
          .toUpperCase();

        const isTrailerType = trailerTypeIds.includes(Number(v.vehicleTypeId));

        return isTrailerType && ["YEARLY", "ANNUAL"].includes(passType);
      });

      const hasOilDockVehicle = (vehicles || []).some((v) =>
        isOilDockArea(v.accessAreaId || v.accessArea),
      );
      const ALLOWED_VENDOR_OIL_JETTY_DEPARTMENTS = new Set([3, 4, 9]);

      const oilJettyVehicles = (vehicles || []).filter((v) =>
        isOilDockArea(v.accessAreaId || v.accessArea),
      );

      for (const vehicle of oilJettyVehicles) {
        const concernDepartmentId = Number(vehicle.concernDepartmentId);

        if (!ALLOWED_VENDOR_OIL_JETTY_DEPARTMENTS.has(concernDepartmentId)) {
          throw new Error(
            "Oil Jetty vehicle requires Civil, Mechanical, or Traffic department selection.",
          );
        }
      }
      const selectedConcernDepartments = [
        ...new Set(oilJettyVehicles.map((v) => Number(v.concernDepartmentId))),
      ];

      if (selectedConcernDepartments.length > 1) {
        throw new Error(
          "All Oil Jetty vehicles in one request must use the same concern department.",
        );
      }

      // const hasOilDockPerson = (persons || []).some((p) =>
      //   isOilDockArea(p.accessAreaId || p.accessArea),
      // );

      // const hasOilDockEntity = hasOilDockVehicle || hasOilDockPerson;

      /*
       * NEW VENDOR OIL-JETTY WORKFLOW
       *
       * Marine
       *   -> Concern Department
       *   -> CISF
       *   -> Traffic
       *
       * Only NEW vendor Oil-Jetty submissions use this branch.
       *
       * Existing non-Oil-Dock vendor flows remain unchanged.
       */
      // if (hasOilDockEntity) {
      //   initialWorkflowState = "PENDING_VENDOR_MARINE";
      // } else if (hasMonthlyYearlyVehicle) {
      //   initialWorkflowState = "PENDING_SAFETY";
      // }
      const hasOilDockPerson = (persons || []).some((p) =>
        isOilDockArea(p.accessAreaId || p.accessArea),
      );
      const isOilDock = hasOilDockVehicle || hasOilDockPerson;

      const oilJettyPersons = (persons || []).filter((p) =>
        isOilDockArea(p.accessAreaId || p.accessArea),
      );

      const personConcernDepartmentIds = [
        ...new Set(oilJettyPersons.map((p) => Number(p.concernDepartmentId))),
      ];

      for (const person of oilJettyPersons) {
        const concernDepartmentId = Number(person.concernDepartmentId);

        if (!ALLOWED_VENDOR_OIL_JETTY_DEPARTMENTS.has(concernDepartmentId)) {
          throw new Error(
            "Oil Jetty person requires Civil, Mechanical, or Traffic department selection.",
          );
        }
      }

      if (personConcernDepartmentIds.length > 1) {
        throw new Error(
          "All Oil Jetty persons in one request must use the same concern department.",
        );
      }

      /*
       * ==========================================================
       * VENDOR ENTITY WORKFLOW INITIALIZATION
       *
       * IMPORTANT:
       * Person and vehicle workflows are independent.
       * A single vendor request may contain both.
       *
       * vendor_pass_requests.workflowState is kept only as the
       * parent/request status and must NOT be used to decide
       * whether a person is Marine/Civil/CISF/etc.
       * ==========================================================
       */

      /*
       * ----------------------------------------------------------
       * PERSON WORKFLOW
       * ----------------------------------------------------------
       */
      for (const person of persons || []) {
        const personArea = person.accessAreaId || person.accessArea;

        if (!isOilDockArea(personArea)) {
          continue;
        }

        const departmentId = Number(person.concernDepartmentId);

        if (!ALLOWED_VENDOR_OIL_JETTY_DEPARTMENTS.has(departmentId)) {
          throw new Error(
            "Oil Jetty person requires Civil, Mechanical, or Traffic department selection.",
          );
        }

        if (departmentId === 3 || departmentId === 4) {
          person.workflowState = "PENDING_VENDOR_PERSON_CONCERN_DEPARTMENT";
        } else if (departmentId === 9) {
          person.workflowState = "PENDING_VENDOR_PERSON_TRAFFIC";
        }

        person.workflowActionStage = null;
        person.workflowActionRemarks = null;
      }

      /*
       * ----------------------------------------------------------
       * VEHICLE WORKFLOW
       * ----------------------------------------------------------
       */
      for (const vehicle of vehicles || []) {
        const vehicleArea = vehicle.accessAreaId || vehicle.accessArea;

        if (!isOilDockArea(vehicleArea)) {
          continue;
        }

        const departmentId = Number(vehicle.concernDepartmentId);

        if (!ALLOWED_VENDOR_OIL_JETTY_DEPARTMENTS.has(departmentId)) {
          throw new Error(
            "Oil Jetty vehicle requires Civil, Mechanical, or Traffic department selection.",
          );
        }

        vehicle.workflowState = "PENDING_VENDOR_MARINE";
        vehicle.workflowActionStage = null;
        vehicle.workflowActionRemarks = null;
      }

      // ============================================================
      // NORMAL ANNUAL TRAILER / TRAILER LORRY FLOW
      // Other Gates Only -> Pass Section -> Safety Officer
      // ============================================================
      for (const vehicle of vehicles || []) {
        const vehicleArea = vehicle.accessAreaId || vehicle.accessArea;

        if (isOilDockArea(vehicleArea)) {
          continue;
        }

        const passType = String(vehicle.passType || "")
          .trim()
          .toUpperCase();

        const isTrailerType = trailerTypeIds.includes(
          Number(vehicle.vehicleTypeId),
        );

        if (isTrailerType && ["YEARLY", "ANNUAL"].includes(passType)) {
          vehicle.workflowState = "PENDING_PASS_SECTION";
          vehicle.workflowActionStage = null;
          vehicle.workflowActionRemarks = null;
        }
      }

      /*
       * ----------------------------------------------------------
       * PARENT REQUEST WORKFLOW
       * ----------------------------------------------------------
       *
       * Keep this only as an overall request marker.
       *
       * When both person + vehicle exist, vehicle remains the
       * existing parent-level workflow anchor for backward
       * compatibility. Individual approval MUST use the entity
       * workflowState columns above.
       * ----------------------------------------------------------
       */

      if (hasOilDockVehicle) {
        initialWorkflowState = "PENDING_VENDOR_MARINE";
      } else if (hasOilDockPerson) {
        const firstOilJettyPerson = (persons || []).find((person) =>
          isOilDockArea(person.accessAreaId || person.accessArea),
        );

        const departmentId = Number(firstOilJettyPerson?.concernDepartmentId);

        if (departmentId === 3 || departmentId === 4) {
          initialWorkflowState = "PENDING_VENDOR_PERSON_CONCERN_DEPARTMENT";
        } else if (departmentId === 9) {
          initialWorkflowState = "PENDING_VENDOR_PERSON_TRAFFIC";
        }
      } else if (hasAnnualTrailerVehicle) {
        initialWorkflowState = "PENDING_PASS_SECTION";
      } else if (hasMonthlyYearlyVehicle) {
        initialWorkflowState = "PENDING_SAFETY";
      }

      // Fetch the original request details
      const origRes = await client.query(
        `SELECT * FROM "vendor_pass_requests" WHERE "token" = $1`,
        [token],
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
             "workflowActionStage" = NULL,
             "workflowActionRemarks" = NULL,
             "submittedAt" = NOW(),
             "updatedAt" = NOW()
       WHERE "token" = $1
       RETURNING *`,
        [token, isOilDock, initialWorkflowState],
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
            "visaDocPath", "visaDocName",
            "immigrationDocPath", "immigrationDocName",
            "requisitionLetterPath", "requisitionLetterName",
            "driverLicensePath", "driverLicenseName",
            "policeVerificationPath", "policeVerificationName",
            "employmentProofPath", "employmentProofName",
            "chaLicensePath", "chaLicenseName",
            "passType", "passPeriod", "amount",
            "status", "createdAt", "updatedAt",
            "rateId", "hepTypeId", "designationId", "designationOther",
            "idProofType", "idProofNumber", "countryId", "accessAreaId", "visaNo",
            "passportNo", "cdcNumber", "seafarerPassFor", "seafarerIdType",
            "withTwoWheeler", "vehicleNo", "cdcDocumentPath", "cdcDocumentName",
            "declarationFormPath", "declarationFormName",
            "entryAuthorizationFilePath", "entryAuthorizationFileName","concernDepartmentId","workflowState",
            "workflowActionStage",
            "workflowActionRemarks"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,NOW(),NOW(),$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56,$57,$58,$59,$60)`,
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
            p.visaDocPath || null,
            p.visaDocName || null,
            p.immigrationDocPath || null,
            p.immigrationDocName || null,
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
            p.accessAreaId || p.accessArea || null,
            p.visaNo || null,
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
            p.concernDepartmentId != null
              ? Number(p.concernDepartmentId)
              : null,
            p.workflowState || null,
            p.workflowActionStage || null,
            p.workflowActionRemarks || null,
          ],
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
            "rateId", "vehicleTypeId", "fuelType", "insuranceExpiry", "rcValidity", "accessAreaId","concernDepartmentId",
            "sparkArresterFilePath", "sparkArresterFileName",
            "twistLockFilePath", "twistLockFileName","workflowState",
            "workflowActionStage",
            "workflowActionRemarks"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW(),NOW(),$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)`,
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
            v.vehicleTypeId != null
              ? Number(v.vehicleTypeId)
              : v.type != null
                ? Number(v.type)
                : null,
            v.fuelType || null,
            v.insuranceExpiry || null,
            v.rcValidity || null,
            v.accessAreaId || v.accessArea || null,
            v.concernDepartmentId != null
              ? Number(v.concernDepartmentId)
              : null,
            v.sparkArresterFilePath || null,
            v.sparkArresterFileName || null,
            v.twistLockFilePath || null,
            v.twistLockFileName || null,
            v.workflowState || null,
            v.workflowActionStage || null,
            v.workflowActionRemarks || null,
          ],
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
      [vendorPassId],
    );
    const person = personRes.rows[personIndex];
    if (!person) return null;

    await pool.query(
      `UPDATE "vendor_pass_persons"
       SET "status" = 'approved', "updatedAt" = NOW()
       WHERE id = $1`,
      [person.id],
    );

    const result = await pool.query(
      `SELECT * FROM "vendor_pass_requests" WHERE id = $1`,
      [vendorPassId],
    );
    return result.rows[0] || null;
  },

  async rejectVendorPerson(vendorPassId, personIndex, rejectedReason) {
    const personRes = await pool.query(
      `SELECT id FROM "vendor_pass_persons" WHERE "vendorPassRequestId" = $1 ORDER BY id ASC`,
      [vendorPassId],
    );
    const person = personRes.rows[personIndex];
    if (!person) return null;

    await pool.query(
      `UPDATE "vendor_pass_persons"
       SET "status" = 'rejected', "rejectedReason" = $2, "updatedAt" = NOW()
       WHERE id = $1`,
      [person.id, rejectedReason],
    );

    const result = await pool.query(
      `SELECT * FROM "vendor_pass_requests" WHERE id = $1`,
      [vendorPassId],
    );
    return result.rows[0] || null;
  },

  // async approveVendorVehicle(vendorPassId, vehicleIndex) {
  //   const vehicleRes = await pool.query(
  //     `SELECT
  //    id,
  //    "passType",
  //    "vehicleTypeId",
  //    "accessAreaId",
  //    "workflowState"
  //  FROM "vendor_pass_vehicles"
  //  WHERE "vendorPassRequestId" = $1
  //  ORDER BY id ASC`,
  //     [vendorPassId],
  //   );
  //   const vehicle = vehicleRes.rows[vehicleIndex];
  //   if (!vehicle) return null;

  //   const passType = String(vehicle.passType || "")
  //     .trim()
  //     .toUpperCase();

  //   const vehicleTypeRes = await pool.query(
  //     `SELECT name
  //  FROM vehicle_types
  //  WHERE id = $1`,
  //     [vehicle.vehicleTypeId],
  //   );

  //   const vehicleTypeName = String(vehicleTypeRes.rows[0]?.name || "")
  //     .trim()
  //     .toUpperCase();

  //   const accessArea = String(vehicle.accessAreaId || "")
  //     .trim()
  //     .toUpperCase();

  //   const isOilDock =
  //     accessArea === "1" ||
  //     accessArea.includes("OIL JETTY") ||
  //     accessArea.includes("OIL_JETTY");

  //   /*
  //    * NORMAL VENDOR ANNUAL TRAILER / TRAILER LORRY FLOW
  //    *
  //    * Pass Section approval:
  //    *     PENDING_PASS_SECTION
  //    *             ↓
  //    *     PENDING_SAFETY
  //    *
  //    * Safety Officer approval is handled separately.
  //    */
  //   const isNormalAnnualTrailerPassSection =
  //     !isOilDock &&
  //     vehicle.workflowState === "PENDING_PASS_SECTION" &&
  //     ["YEARLY", "ANNUAL"].includes(passType) &&
  //     ["TRAILORS", "TRAILER LORRY"].includes(vehicleTypeName);

  //   if (isNormalAnnualTrailerPassSection) {
  //     await pool.query(
  //       `
  //     UPDATE "vendor_pass_vehicles"
  //     SET
  //       "status" = 'approved',
  //       "workflowState" = 'PENDING_SAFETY',
  //       "workflowActionStage" = NULL,
  //       "workflowActionRemarks" = NULL,
  //       "updatedAt" = NOW()
  //     WHERE id = $1
  //   `,
  //       [vehicle.id],
  //     );

  //     await pool.query(
  //       `
  //     UPDATE "vendor_pass_requests"
  //     SET
  //       "workflowState" = 'PENDING_SAFETY',
  //       "updatedAt" = NOW()
  //     WHERE id = $1
  //   `,
  //       [vendorPassId],
  //     );
  //   } else {
  //     // EXISTING BEHAVIOUR — DO NOT CHANGE
  //     await pool.query(
  //       `UPDATE "vendor_pass_vehicles"
  //    SET "status" = 'approved', "updatedAt" = NOW()
  //    WHERE id = $1`,
  //       [vehicle.id],
  //     );
  //   }

  //   const result = await pool.query(
  //     `SELECT * FROM "vendor_pass_requests" WHERE id = $1`,
  //     [vendorPassId],
  //   );
  //   return result.rows[0] || null;
  // },

  async approveVendorVehicle(vendorPassId, vehicleIndex) {
    const vehicleRes = await pool.query(
      `
    SELECT
      vpv.id,
      vpv."passType",
      vpv."vehicleTypeId",
      vpv."accessAreaId",
      vpv."workflowState",
      vpr."workflowState" AS "requestWorkflowState",
      vpr."isOilDock"
    FROM "vendor_pass_vehicles" vpv
    INNER JOIN "vendor_pass_requests" vpr
      ON vpr.id = vpv."vendorPassRequestId"
    WHERE vpv."vendorPassRequestId" = $1
    ORDER BY vpv.id ASC
    `,
      [vendorPassId],
    );

    const vehicle = vehicleRes.rows[vehicleIndex];

    if (!vehicle) {
      return null;
    }

    const passType = String(vehicle.passType || "")
      .trim()
      .toUpperCase();

    const vehicleTypeRes = await pool.query(
      `
    SELECT name
    FROM vehicle_types
    WHERE id = $1
    `,
      [vehicle.vehicleTypeId],
    );

    const vehicleTypeName = String(vehicleTypeRes.rows[0]?.name || "")
      .trim()
      .toUpperCase();

    const accessArea = String(vehicle.accessAreaId || "")
      .trim()
      .toUpperCase();

    const isOilDock =
      accessArea === "1" ||
      accessArea.includes("OIL JETTY") ||
      accessArea.includes("OIL_JETTY");

    /*
     * ==========================================================
     * NORMAL VENDOR ANNUAL TRAILER / TRAILER LORRY
     *
     * PASS SECTION
     *      ↓
     * PENDING_SAFETY
     *
     * IMPORTANT:
     * Check the CURRENT CHILD workflow state.
     * Also tolerate a parent request that is already PENDING_SAFETY.
     * ==========================================================
     */

    const isNormalAnnualTrailer =
      !isOilDock &&
      ["YEARLY", "ANNUAL"].includes(passType) &&
      ["TRAILORS", "TRAILER LORRY"].includes(vehicleTypeName);

    const isAtPassSection = vehicle.workflowState === "PENDING_PASS_SECTION";

    const requestAlreadyAtSafety =
      vehicle.requestWorkflowState === "PENDING_SAFETY";

    if (isNormalAnnualTrailer && (isAtPassSection || requestAlreadyAtSafety)) {
      console.log(
        `[VENDOR-PASS] Moving annual trailer vehicle ${vehicle.id} to Safety Officer`,
      );

      // CHILD: Pass Section -> Safety Officer
      await pool.query(
        `
      UPDATE "vendor_pass_vehicles"
      SET
        "status" = 'pending',
        "workflowState" = 'PENDING_SAFETY',
        "workflowActionStage" = NULL,
        "workflowActionRemarks" = NULL,
        "updatedAt" = NOW()
      WHERE id = $1
      `,
        [vehicle.id],
      );

      // PARENT: also keep request at Safety Officer stage
      await pool.query(
        `
      UPDATE "vendor_pass_requests"
      SET
        "status" = 'VENDOR_SUBMITTED',
        "workflowState" = 'PENDING_SAFETY',
        "workflowActionStage" = NULL,
        "workflowActionRemarks" = NULL,
        "updatedAt" = NOW()
      WHERE id = $1
      `,
        [vendorPassId],
      );
    } else {
      /*
       * EXISTING BEHAVIOUR
       * Do not change other vendor workflows.
       */
      await pool.query(
        `
      UPDATE "vendor_pass_vehicles"
      SET
        "status" = 'approved',
        "updatedAt" = NOW()
      WHERE id = $1
      `,
        [vehicle.id],
      );
    }

    const result = await pool.query(
      `
    SELECT *
    FROM "vendor_pass_requests"
    WHERE id = $1
    `,
      [vendorPassId],
    );

    return result.rows[0] || null;
  },

  async revertVendorPerson(vendorPassId, personIndex, revertReason) {
    const personRes = await pool.query(
      `SELECT id FROM "vendor_pass_persons" WHERE "vendorPassRequestId" = $1 ORDER BY id ASC`,
      [vendorPassId],
    );
    const person = personRes.rows[personIndex];
    if (!person) return null;

    await pool.query(
      `UPDATE "vendor_pass_persons"
       SET "status" = 'reverted', "revertReason" = $2, "isReverted" = true, "lastRevertReason" = $2, "updatedAt" = NOW()
       WHERE id = $1`,
      [person.id, revertReason],
    );

    const result = await pool.query(
      `SELECT * FROM "vendor_pass_requests" WHERE id = $1`,
      [vendorPassId],
    );
    return result.rows[0] || null;
  },

  async updateVendorPerson(vendorPassId, personIndex, updatedData) {
    const personRes = await pool.query(
      `SELECT id, "personPassNo" FROM "vendor_pass_persons" WHERE "vendorPassRequestId" = $1 ORDER BY id ASC`,
      [vendorPassId],
    );
    const person = personRes.rows[personIndex];
    if (!person) throw new Error("Person not found");

    const allowedFields = [
      "name",
      "mobile",
      "email",
      "aadharNo",
      "nationality",
      "dateFrom",
      "dateTo",
      "photoFilePath",
      "photoFileName",
      "idProofFilePath",
      "idProofFileName",
      "aadharPDFFilePATH",
      "aadharPDFFileName",
      "passportPath",
      "passportName",
      "visaDocPath",
      "visaDocName",
      "immigrationDocPath",
      "immigrationDocName",
      "requisitionLetterPath",
      "requisitionLetterName",
      "driverLicensePath",
      "driverLicenseName",
      "policeVerificationPath",
      "policeVerificationName",
      "employmentProofPath",
      "employmentProofName",
      "chaLicensePath",
      "chaLicenseName",
      "passType",
      "passPeriod",
      "amount",
      "rateId",
      "hepTypeId",
      "designationId",
      "designationOther",
      "idProofType",
      "idProofNumber",
      "countryId",
      "accessAreaId",
      "concernDepartmentId",
      "cardNumber",
      "visaNo",
      "passportNo",
      "cdcNumber",
      "seafarerPassFor",
      "seafarerIdType",
      "withTwoWheeler",
      "vehicleNo",
      "cdcDocumentPath",
      "cdcDocumentName",
      "declarationFormPath",
      "declarationFormName",
      "entryAuthorizationFilePath",
      "entryAuthorizationFileName",
    ];

    const updates = ['"updatedAt" = NOW()'];
    const values = [person.id];
    let paramIndex = 2;

    for (const field of allowedFields) {
      if (updatedData[field] !== undefined) {
        updates.push(`"${field}" = $${paramIndex}`);
        if (field === "withTwoWheeler") {
          values.push(
            updatedData[field] === true || updatedData[field] === "true",
          );
        } else if (
          [
            "rateId",
            "hepTypeId",
            "designationId",
            "countryId",
            "passPeriod",
          ].includes(field)
        ) {
          values.push(
            updatedData[field] != null ? Number(updatedData[field]) : null,
          );
        } else if (field === "amount") {
          values.push(updatedData[field] != null ? updatedData[field] : null);
        } else if (field === "passType" && updatedData[field] === "ANNUAL") {
          values.push("YEARLY");
        } else {
          values.push(updatedData[field]);
        }
        paramIndex++;
      }
    }

    const query = `UPDATE "vendor_pass_persons" SET ${updates.join(", ")} WHERE id = $1`;
    await pool.query(query, values);
    return true;
  },

  async updateVendorVehicle(vendorPassId, vehicleIndex, updatedData) {
    const vehicleRes = await pool.query(
      `SELECT * FROM "vendor_pass_vehicles" WHERE "vendorPassRequestId" = $1 ORDER BY id ASC`,
      [vendorPassId],
    );
    const vehicle = vehicleRes.rows[vehicleIndex];
    if (!vehicle) throw new Error("Vehicle not found");

    const allowedFields = [
      "vehicleRegistrationNo",
      "vehicleType",
      "dateFrom",
      "dateTo",
      "scannedCopyFilePath",
      "scannedCopyFileName",
      "insuranceFilePath",
      "insuranceFileName",
      "permitFilePath",
      "permitFileName",
      "fitnessFilePath",
      "fitnessFileName",
      "requestLetterPath",
      "requestLetterName",
      "taxFilePath",
      "taxFileName",
      "emissionFilePath",
      "emissionFileName",
      "passType",
      "passPeriod",
      "amount",
      "rateId",
      "vehicleTypeId",
      "fuelType",
      "insuranceExpiry",
      "rcValidity",
      "accessAreaId",
      "concernDepartmentId",
      "sparkArresterFilePath",
      "sparkArresterFileName",
      "twistLockFilePath",
      "twistLockFileName",
    ];

    // Handle mapping registrationNo -> vehicleRegistrationNo
    if (
      updatedData.registrationNo !== undefined &&
      updatedData.vehicleRegistrationNo === undefined
    ) {
      updatedData.vehicleRegistrationNo = updatedData.registrationNo;
    }

    const updateFields = {};

    for (const field of allowedFields) {
      if (updatedData[field] !== undefined) {
        let val;
        if (["rateId", "vehicleTypeId", "passPeriod"].includes(field)) {
          val = updatedData[field] != null ? Number(updatedData[field]) : null;
        } else if (field === "amount") {
          val = updatedData[field] != null ? updatedData[field] : null;
        } else if (field === "passType" && updatedData[field] === "ANNUAL") {
          val = "YEARLY";
        } else {
          val = updatedData[field];
        }
        updateFields[field] = val;
      }
    }
    const normalizedAccessArea = String(
      updatedData.accessAreaId !== undefined
        ? updatedData.accessAreaId
        : vehicle.accessAreaId || "",
    )
      .trim()
      .toUpperCase();

    const vehicleIsOilJetty =
      normalizedAccessArea === "1" ||
      normalizedAccessArea.includes("OIL JETTY") ||
      normalizedAccessArea.includes("OIL_JETTY");

    if (vehicleIsOilJetty) {
      const concernDepartmentId = Number(
        updatedData.concernDepartmentId !== undefined
          ? updatedData.concernDepartmentId
          : vehicle.concernDepartmentId,
      );

      if (![3, 4, 9].includes(concernDepartmentId)) {
        throw new Error(
          "Oil Jetty vehicle requires Civil, Mechanical, or Traffic department selection.",
        );
      }

      updateFields.concernDepartmentId = concernDepartmentId;
    } else {
      updateFields.concernDepartmentId = null;
    }

    const updatedPassType =
      updatedData.passType !== undefined
        ? updatedData.passType
        : vehicle.passType;
    const normalizedPassType =
      updatedPassType === "ANNUAL" ? "YEARLY" : updatedPassType || "";
    const updatedAccessArea = String(
      updatedData.accessAreaId !== undefined
        ? updatedData.accessAreaId
        : vehicle.accessAreaId || "",
    ).toUpperCase();
    const isOilDock =
      updatedAccessArea === "1" ||
      updatedAccessArea.includes("OIL JETTY") ||
      updatedAccessArea.includes("OIL_JETTY");
    const isMonthlyYearly =
      ["MONTHLY", "YEARLY", "ANNUAL"].includes(normalizedPassType) ||
      ["2", "3"].includes(
        String(
          updatedData.passPeriod !== undefined
            ? updatedData.passPeriod
            : vehicle.passPeriod,
        ),
      );

    // If pass type is DAILY (not monthly/yearly), twist lock is not needed
    if (
      normalizedPassType === "DAILY" ||
      (!isMonthlyYearly && normalizedPassType)
    ) {
      updateFields["twistLockFilePath"] = null;
      updateFields["twistLockFileName"] = null;
      updateFields["twistLockCertified"] = false;
      updateFields["twistLockRemarks"] = null;
    }

    // If access area is NOT Oil Dock, spark arrester is not needed
    if (!isOilDock && updatedAccessArea) {
      updateFields["sparkArresterFilePath"] = null;
      updateFields["sparkArresterFileName"] = null;
      updateFields["sparkArresterCertified"] = false;
      updateFields["sparkArresterRemarks"] = null;
      updateFields["srDtmApproved"] = false;
      updateFields["srDtmRemarks"] = null;
    }

    // Invalidation logic: if files changed or config changed, reset certifications
    const newTwistLockUploaded =
      updatedData.twistLockFilePath !== undefined &&
      updatedData.twistLockFilePath !== vehicle.twistLockFilePath;
    const passTypeChangedToMonthlyYearly =
      isMonthlyYearly &&
      !(
        ["MONTHLY", "YEARLY", "ANNUAL"].includes(vehicle.passType) ||
        ["2", "3"].includes(String(vehicle.passPeriod))
      );
    if (newTwistLockUploaded || passTypeChangedToMonthlyYearly) {
      updateFields["twistLockCertified"] = false;
      updateFields["twistLockRemarks"] = null;
    }

    const newSparkArresterUploaded =
      updatedData.sparkArresterFilePath !== undefined &&
      updatedData.sparkArresterFilePath !== vehicle.sparkArresterFilePath;
    const existingArea = String(vehicle.accessAreaId || "").toUpperCase();
    const existingIsOilDock =
      existingArea === "1" ||
      existingArea.includes("OIL JETTY") ||
      existingArea.includes("OIL_JETTY");
    const accessAreaChangedToOilDock = isOilDock && !existingIsOilDock;
    if (newSparkArresterUploaded || accessAreaChangedToOilDock) {
      updateFields["sparkArresterCertified"] = false;
      updateFields["sparkArresterRemarks"] = null;
      updateFields["srDtmApproved"] = false;
      updateFields["srDtmRemarks"] = null;
    }

    const updates = ['"updatedAt" = NOW()'];
    const values = [vehicle.id];
    let paramIndex = 2;

    for (const [field, val] of Object.entries(updateFields)) {
      updates.push(`"${field}" = $${paramIndex}`);
      values.push(val);
      paramIndex++;
    }

    const query = `UPDATE "vendor_pass_vehicles" SET ${updates.join(", ")} WHERE id = $1`;
    await pool.query(query, values);
    return true;
  },

  async resubmitRevertedVendorPass(vendorPassId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      /*
       * ==========================================================
       * NEW VENDOR OIL-JETTY REVERT / RESUBMIT
       *
       * If this request belongs to the NEW workflow and was
       * reverted by Marine / Concern / CISF / Traffic:
       *
       *     vendor edits request
       *             ↓
       *     resubmits
       *             ↓
       *     PENDING_VENDOR_MARINE
       *
       * Existing legacy vendor workflow remains untouched.
       * ==========================================================
       */

      const requestRes = await client.query(
        `
          SELECT
            id,
            status,
            "isOilDock",
            "workflowState",
            "workflowActionStage"
          FROM "vendor_pass_requests"
          WHERE id = $1
          FOR UPDATE
        `,
        [vendorPassId],
      );

      if (requestRes.rows.length === 0) {
        throw new Error("Vendor pass request not found");
      }

      const request = requestRes.rows[0];

      const isNewVendorPersonOilJettyRevert =
        request.status === "REVERTED" &&
        request.isOilDock === true &&
        ["PERSON_CONCERN_DEPARTMENT", "PERSON_TRAFFIC"].includes(
          String(request.workflowActionStage || "").toUpperCase(),
        );

      if (isNewVendorPersonOilJettyRevert) {
        const personRes = await client.query(
          `
      SELECT DISTINCT "concernDepartmentId"
      FROM "vendor_pass_persons"
      WHERE "vendorPassRequestId" = $1
        AND "concernDepartmentId" IS NOT NULL
    `,
          [vendorPassId],
        );

        const departmentIds = personRes.rows.map((row) =>
          Number(row.concernDepartmentId),
        );

        if (departmentIds.length !== 1) {
          throw new Error(
            "Vendor person Oil-Jetty resubmission requires exactly one concern department.",
          );
        }

        const selectedDepartmentId = departmentIds[0];

        const nextWorkflowState =
          selectedDepartmentId === 9
            ? "PENDING_VENDOR_PERSON_TRAFFIC"
            : [3, 4].includes(selectedDepartmentId)
              ? "PENDING_VENDOR_PERSON_CONCERN_DEPARTMENT"
              : null;

        if (!nextWorkflowState) {
          throw new Error(
            "Invalid concern department for Vendor person Oil-Jetty resubmission.",
          );
        }

        await client.query(
          `
      UPDATE "vendor_pass_persons"
      SET
        "status" = 'pending',
        "isReverted" = false,
        "updatedAt" = NOW()
      WHERE "vendorPassRequestId" = $1
        AND "status" != 'rejected'
    `,
          [vendorPassId],
        );

        const result = await client.query(
          `
      UPDATE "vendor_pass_requests"
      SET
        "status" = 'VENDOR_SUBMITTED',
        "workflowState" = $2,
        "workflowActionStage" = NULL,
        "workflowActionRemarks" = NULL,
        "approvedBy" = NULL,
        "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *
    `,
          [vendorPassId, nextWorkflowState],
        );

        await client.query("COMMIT");

        return result.rows[0];
      }

      const isNewVendorOilJettyRevert =
        request.status === "REVERTED" &&
        request.isOilDock === true &&
        ["MARINE", "CONCERN_DEPARTMENT", "CISF", "TRAFFIC"].includes(
          String(request.workflowActionStage || "").toUpperCase(),
        );

      if (isNewVendorOilJettyRevert) {
        /*
         * Reset all non-rejected entities back to pending.
         *
         * The new workflow is request-level, so we do not use
         * srDtmApproved / sparkArrester / twistLock as routing
         * decisions here.
         */
        await client.query(
          `
            UPDATE "vendor_pass_persons"
            SET
              "status" = 'pending',
              "isReverted" = false,
              "updatedAt" = NOW()
            WHERE "vendorPassRequestId" = $1
              AND "status" != 'rejected'
          `,
          [vendorPassId],
        );

        await client.query(
          `
            UPDATE "vendor_pass_vehicles"
            SET
              "status" = 'pending',
              "isReverted" = false,
              "updatedAt" = NOW()
            WHERE "vendorPassRequestId" = $1
              AND "status" != 'rejected'
          `,
          [vendorPassId],
        );

        /*
         * Restart the NEW workflow from Marine.
         */
        const newWorkflowResult = await client.query(
          `
            UPDATE "vendor_pass_requests"
            SET
              "status" = 'VENDOR_SUBMITTED',
              "workflowState" = 'PENDING_VENDOR_MARINE',
              "workflowActionStage" = NULL,
              "workflowActionRemarks" = NULL,
              "approvedBy" = NULL,
              "updatedAt" = NOW()
            WHERE id = $1
            RETURNING *
          `,
          [vendorPassId],
        );

        await client.query("COMMIT");

        return newWorkflowResult.rows[0];
      }

      /*
       * ==========================================================
       * IMPORTANT:
       *
       * If it is NOT the new Vendor Oil-Jetty workflow, DO NOT
       * return here.
       *
       * Let your EXISTING legacy resubmit logic continue below.
       * ==========================================================
       */

      // Fetch all persons and vehicles for this vendor pass request to determine workflowState
      const personsRes = await client.query(
        `SELECT "accessAreaId" FROM "vendor_pass_persons" WHERE "vendorPassRequestId" = $1`,
        [vendorPassId],
      );
      const vehiclesRes = await client.query(
        `
          SELECT
            vpv."accessAreaId",
            vpv."passType",
            vpv."vehicleTypeId",
            vt.name AS "vehicleTypeName"
          FROM "vendor_pass_vehicles" vpv
          LEFT JOIN vehicle_types vt
            ON vt.id = vpv."vehicleTypeId"
          WHERE vpv."vendorPassRequestId" = $1
        `,
        [vendorPassId],
      );

      const isPersonOilDock = personsRes.rows.some((p) => {
        const area = String(p.accessAreaId || "").toUpperCase();
        return (
          area === "1" ||
          area.includes("OIL JETTY") ||
          area.includes("OIL_JETTY")
        );
      });
      const isVehicleOilDock = vehiclesRes.rows.some((v) => {
        const area = String(v.accessAreaId || "").toUpperCase();
        return (
          area === "1" ||
          area.includes("OIL JETTY") ||
          area.includes("OIL_JETTY")
        );
      });
      const isOilDock = isPersonOilDock || isVehicleOilDock;

      const hasMonthlyYearlyVehicle = vehiclesRes.rows.some(
        (v) =>
          v.passType === "MONTHLY" ||
          v.passType === "YEARLY" ||
          v.passType === "ANNUAL",
      );
      const hasAnnualTrailerVehicle = vehiclesRes.rows.some((v) => {
        const passType = String(v.passType || "")
          .trim()
          .toUpperCase();

        const vehicleType = String(v.vehicleTypeName || "")
          .trim()
          .toUpperCase();

        return (
          ["YEARLY", "ANNUAL"].includes(passType) &&
          ["TRAILORS", "TRAILER LORRY"].includes(vehicleType)
        );
      });
      const hasAnyVehicle = vehiclesRes.rows.length > 0;

      let workflowState = "PENDING_PASS_SECTION";

      if (hasAnnualTrailerVehicle && !isOilDock) {
        workflowState = "PENDING_PASS_SECTION";
      } else if (isVehicleOilDock) {
        workflowState = "PENDING_FIRE_SAFETY";
      } else if (isPersonOilDock) {
        workflowState = "PENDING_SR_DTM";
      } else if (hasMonthlyYearlyVehicle) {
        workflowState = "PENDING_SAFETY";
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
        [vendorPassId],
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
       "workflowState" = CASE
         WHEN "vendorPassRequestId" = $1
              AND "vehicleTypeId" IN (
                SELECT id
                FROM vehicle_types
                WHERE UPPER(TRIM(name)) IN ('TRAILORS', 'TRAILER LORRY')
              )
              AND UPPER(TRIM("passType")) IN ('YEARLY', 'ANNUAL')
         THEN 'PENDING_PASS_SECTION'
         ELSE "workflowState"
       END,
       "workflowActionStage" = CASE
         WHEN "vehicleTypeId" IN (
           SELECT id
           FROM vehicle_types
           WHERE UPPER(TRIM(name)) IN ('TRAILORS', 'TRAILER LORRY')
         )
         AND UPPER(TRIM("passType")) IN ('YEARLY', 'ANNUAL')
         THEN NULL
         ELSE "workflowActionStage"
       END,
       "workflowActionRemarks" = CASE
         WHEN "vehicleTypeId" IN (
           SELECT id
           FROM vehicle_types
           WHERE UPPER(TRIM(name)) IN ('TRAILORS', 'TRAILER LORRY')
         )
         AND UPPER(TRIM("passType")) IN ('YEARLY', 'ANNUAL')
         THEN NULL
         ELSE "workflowActionRemarks"
       END,
       "updatedAt" = NOW()
   WHERE "vendorPassRequestId" = $1 AND status != 'rejected'`,
        [vendorPassId],
      );

      await client.query(
        `UPDATE "vendor_pass_requests" 
         SET status = 'VENDOR_SUBMITTED', "isOilDock" = $2, "workflowState" = $3, "updatedAt" = NOW() 
         WHERE id = $1`,
        [vendorPassId, isOilDock, workflowState],
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
      [vendorPassId],
    );
    const vehicle = vehicleRes.rows[vehicleIndex];
    if (!vehicle) return null;

    await pool.query(
      `UPDATE "vendor_pass_vehicles"
       SET "status" = 'reverted', "revertReason" = $2, "isReverted" = true, "lastRevertReason" = $2, "updatedAt" = NOW()
       WHERE id = $1`,
      [vehicle.id, revertReason],
    );

    const result = await pool.query(
      `SELECT * FROM "vendor_pass_requests" WHERE id = $1`,
      [vendorPassId],
    );
    return result.rows[0] || null;
  },

  async rejectVendorVehicle(vendorPassId, vehicleIndex, rejectedReason) {
    const vehicleRes = await pool.query(
      `SELECT id FROM "vendor_pass_vehicles" WHERE "vendorPassRequestId" = $1 ORDER BY id ASC`,
      [vendorPassId],
    );
    const vehicle = vehicleRes.rows[vehicleIndex];
    if (!vehicle) return null;

    await pool.query(
      `UPDATE "vendor_pass_vehicles"
       SET "status" = 'rejected', "rejectedReason" = $2, "updatedAt" = NOW()
       WHERE id = $1`,
      [vehicle.id, rejectedReason],
    );

    const result = await pool.query(
      `SELECT * FROM "vendor_pass_requests" WHERE id = $1`,
      [vendorPassId],
    );
    return result.rows[0] || null;
  },

  async completeVendorPassReview(
    vendorPassId,
    approvedByUserId,
    role,
    roleId = null,
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Run independent queries in parallel for better performance
      const [vendorRes, personsRes, vehiclesRes] = await Promise.all([
        client.query(
          `SELECT
              "vendorEmail",
              "companyName",
              "referenceNo",
              "validUpto",
              "departmentName",
              "token",
              "isOilDock",
              "workflowState"
          FROM "vendor_pass_requests"
          WHERE id = $1`,
          [vendorPassId],
        ),
        client.query(
          `SELECT id, status, "srDtmApproved" FROM "vendor_pass_persons" WHERE "vendorPassRequestId" = $1`,
          [vendorPassId],
        ),
        client.query(
          `SELECT
              pv.id,
              pv.status,
              pv."passType",
              pv."twistLockCertified",
              pv."sparkArresterCertified",
              pv."vehicleTypeId",
              vt.name AS "vehicleTypeName"
          FROM "vendor_pass_vehicles" pv
          LEFT JOIN vehicle_types vt
            ON vt.id = pv."vehicleTypeId"
          WHERE pv."vendorPassRequestId" = $1`,
          [vendorPassId],
        ),
      ]);

      if (vendorRes.rows.length === 0) {
        throw new Error("Vendor pass request not found");
      }

      const row = vendorRes.rows[0];
      const persons = personsRes.rows;
      const vehicles = vehiclesRes.rows;
      const isNormalAnnualTrailer =
        row.isOilDock !== true &&
        vehicles.some((v) => {
          const passType = String(v.passType || "")
            .trim()
            .toUpperCase();

          const vehicleType = String(v.vehicleTypeName || "")
            .trim()
            .toUpperCase();

          return (
            ["YEARLY", "ANNUAL"].includes(passType) &&
            ["TRAILORS", "TRAILER LORRY"].includes(vehicleType)
          );
        });

      // Check if any reverted entities
      const hasRevertedPerson = persons.some((p) => p.status === "reverted");
      const hasRevertedVehicle = vehicles.some((v) => v.status === "reverted");
      const isReverted = hasRevertedPerson || hasRevertedVehicle;

      let approvedBy = null;
      if (approvedByUserId) {
        try {
          const userRes = await client.query(
            'SELECT "userName" FROM "users" WHERE id = $1',
            [approvedByUserId],
          );
          if (userRes.rows.length > 0) {
            approvedBy = userRes.rows[0].userName;
          }
        } catch (userErr) {
          console.error(
            "Error looking up vendor pass approver user details:",
            userErr,
          );
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
          [vendorPassId, approvedBy],
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
            const revertedPersonsList = persons.filter(
              (p) => p.status === "reverted",
            );
            const revertedVehiclesList = vehicles.filter(
              (v) => v.status === "reverted",
            );

            // Fetch reverted entity names and reasons
            const revertedEntities = [];
            if (revertedPersonsList.length > 0) {
              const personDetails = await client.query(
                `SELECT id, name, "revertReason" FROM "vendor_pass_persons" WHERE id = ANY($1)`,
                [revertedPersonsList.map((p) => p.id)],
              );
              personDetails.rows.forEach((p) => {
                revertedEntities.push({
                  type: "person",
                  name: p.name || `Person ${p.id}`,
                  reason: p.revertReason || "Correction required",
                });
              });
            }
            if (revertedVehiclesList.length > 0) {
              const vehicleDetails = await client.query(
                `SELECT id, "vehicleRegistrationNo", "revertReason" FROM "vendor_pass_vehicles" WHERE id = ANY($1)`,
                [revertedVehiclesList.map((v) => v.id)],
              );
              vehicleDetails.rows.forEach((v) => {
                revertedEntities.push({
                  type: "vehicle",
                  name: v.vehicleRegistrationNo || `Vehicle ${v.id}`,
                  reason: v.revertReason || "Correction required",
                });
              });
            }

            axios
              .post(
                `${EMAIL_SERVICE_URL}/api/email/sendPassReverted`,
                {
                  email: row.vendorEmail,
                  name: row.companyName,
                  referenceNumber: row.referenceNo,
                  revertedEntities: revertedEntities,
                  revertedCount: revertedEntities.length,
                  formLink: formLink,
                },
                {
                  headers: { "x-service-name": "USER-SERVICE" },
                  timeout: 8000,
                },
              )
              .then(() => {
                console.log(
                  `[VENDOR-PASS] Revert email sent to ${row.vendorEmail} for ${row.referenceNo}`,
                );
              })
              .catch((emailErr) => {
                console.error(
                  `[VENDOR-PASS] Failed to send revert email:`,
                  emailErr.message,
                );
              });
          } catch (emailErr) {
            console.error(
              `[VENDOR-PASS] Failed to trigger revert email:`,
              emailErr.message,
            );
          }
        }

        return {
          ...result.rows[0],
          reviewStatus: "REVERTED",
          message:
            "Review saved. Vendor pass request has reverted entities that need correction.",
        };
      }

      const isSafety = roleId === 26 || role === "Safety Officer";
      const isFireSafety = roleId === 27 || role === "Fire Safety Officer";
      const isSrDtm = roleId === 28 || role === "Senior Deputy Traffic Manager";

      const isOilDockArea = (val) => {
        if (!val) return false;
        const str = String(val).toUpperCase();
        return (
          str === "1" || str.includes("OIL JETTY") || str.includes("OIL_JETTY")
        );
      };

      if (isSafety && isNormalAnnualTrailer) {
        const uncertifiedTrailerVehicles = vehicles.filter((v) => {
          const passType = String(v.passType || "")
            .trim()
            .toUpperCase();

          const vehicleType = String(v.vehicleTypeName || "")
            .trim()
            .toUpperCase();

          return (
            v.status !== "rejected" &&
            ["YEARLY", "ANNUAL"].includes(passType) &&
            ["TRAILORS", "TRAILER LORRY"].includes(vehicleType) &&
            !v.twistLockCertified
          );
        });

        if (uncertifiedTrailerVehicles.length > 0) {
          throw new Error(
            "All Trailer/Lorry vehicles must be certified by the Safety Officer.",
          );
        }
      }

      if (isSafety && !isNormalAnnualTrailer) {
        const uncertifiedVehicles = vehicles.filter(
          (v) =>
            v.status !== "rejected" &&
            (v.passType === "MONTHLY" || v.passType === "YEARLY") &&
            !v.twistLockCertified,
        );
        if (uncertifiedVehicles.length > 0) {
          throw new Error(
            "All monthly/yearly vehicles must be certified by the Safety Officer.",
          );
        }

        const prRes = await client.query(
          `SELECT "isOilDock" FROM "vendor_pass_requests" WHERE id = $1`,
          [vendorPassId],
        );
        const isOilDock = prRes.rows[0]?.isOilDock;
        const nextState = isOilDock
          ? "PENDING_FIRE_SAFETY"
          : "PENDING_PASS_SECTION";

        // Reset entity statuses to 'pending' when entering Pass Section queue
        if (nextState === "PENDING_PASS_SECTION") {
          await client.query(
            `
            UPDATE "vendor_pass_persons" SET status = 'pending', "updatedAt" = NOW()
            WHERE "vendorPassRequestId" = $1 AND status = 'approved'
          `,
            [vendorPassId],
          );
          await client.query(
            `
            UPDATE "vendor_pass_vehicles" SET status = 'pending', "updatedAt" = NOW()
            WHERE "vendorPassRequestId" = $1 AND status = 'approved'
          `,
            [vendorPassId],
          );
        }

        const result = await client.query(
          `
          UPDATE "vendor_pass_requests"
          SET "workflowState" = $2, "approvedBy" = $3, "updatedAt" = NOW()
          WHERE id = $1
          RETURNING *
        `,
          [vendorPassId, nextState, approvedBy],
        );
        await client.query("COMMIT");
        client.release();
        return {
          ...result.rows[0],
          reviewStatus: "PENDING_NEXT",
          message: "Safety Officer pre-approval completed.",
        };
      }

      if (isFireSafety) {
        const oilDockVehicles = vehicles.filter((v) =>
          isOilDockArea(v.accessAreaId),
        );
        const uncertifiedVehicles = oilDockVehicles.filter(
          (v) => v.status !== "rejected" && !v.sparkArresterCertified,
        );
        if (uncertifiedVehicles.length > 0) {
          throw new Error(
            "All vehicles must be certified by the Fire Safety Officer.",
          );
        }

        const result = await client.query(
          `
          UPDATE "vendor_pass_requests"
          SET "workflowState" = 'PENDING_SR_DTM', "approvedBy" = $2, "updatedAt" = NOW()
          WHERE id = $1
          RETURNING *
        `,
          [vendorPassId, approvedBy],
        );
        await client.query("COMMIT");
        client.release();
        return {
          ...result.rows[0],
          reviewStatus: "PENDING_NEXT",
          message: "Fire Safety Officer pre-approval completed.",
        };
      }

      if (isSrDtm) {
        const oilDockPersons = persons.filter((p) =>
          isOilDockArea(p.accessAreaId),
        );
        const unapprovedPersons = oilDockPersons.filter(
          (p) => p.status !== "rejected" && !p.srDtmApproved,
        );
        if (unapprovedPersons.length > 0) {
          throw new Error(
            "All persons must be approved by the Senior Deputy Traffic Manager.",
          );
        }

        const oilDockVehicles = vehicles.filter((v) =>
          isOilDockArea(v.accessAreaId),
        );
        const unapprovedVehicles = oilDockVehicles.filter(
          (v) => !["approved", "rejected", "reverted"].includes(v.status),
        );
        if (unapprovedVehicles.length > 0) {
          throw new Error(
            "All vehicles must be approved by the Senior Deputy Traffic Manager.",
          );
        }

        // Reset entity statuses to 'pending' when entering Pass Section queue
        await client.query(
          `
          UPDATE "vendor_pass_persons" SET status = 'pending', "updatedAt" = NOW()
          WHERE "vendorPassRequestId" = $1 AND status = 'approved'
        `,
          [vendorPassId],
        );
        await client.query(
          `
          UPDATE "vendor_pass_vehicles" SET status = 'pending', "updatedAt" = NOW()
          WHERE "vendorPassRequestId" = $1 AND status = 'approved'
        `,
          [vendorPassId],
        );

        const result = await client.query(
          `
          UPDATE "vendor_pass_requests"
          SET "workflowState" = 'PENDING_PASS_SECTION', "approvedBy" = $2, "updatedAt" = NOW()
          WHERE id = $1
          RETURNING *
        `,
          [vendorPassId, approvedBy],
        );
        await client.query("COMMIT");
        client.release();
        return {
          ...result.rows[0],
          reviewStatus: "PENDING_NEXT",
          message: "Senior Deputy Traffic Manager pre-approval completed.",
        };
      }

      // Check if all reviewed
      const allPersonsReviewed = persons.every((p) =>
        ["approved", "rejected", "reverted"].includes(p.status),
      );
      const allVehiclesReviewed = vehicles.every((v) =>
        ["approved", "rejected", "reverted"].includes(v.status),
      );
      const allReviewed = allPersonsReviewed && allVehiclesReviewed;
      if (
        isNormalAnnualTrailer &&
        !isSafety &&
        !isFireSafety &&
        !isSrDtm
        // && allReviewed
      ) {
        const annualTrailerVehicleIds = vehicles
          .filter((v) => {
            const passType = String(v.passType || "")
              .trim()
              .toUpperCase();

            const vehicleType = String(v.vehicleTypeName || "")
              .trim()
              .toUpperCase();

            const workflowState = String(v.workflowState || "")
              .trim()
              .toUpperCase();

            return (
              v.status === "approved" &&
              workflowState === "PENDING_PASS_SECTION" &&
              ["YEARLY", "ANNUAL"].includes(passType) &&
              ["TRAILORS", "TRAILER LORRY"].includes(vehicleType)
            );
          })
          .map((v) => v.id);

        if (annualTrailerVehicleIds.length > 0) {
          await client.query(
            `
      UPDATE "vendor_pass_vehicles"
      SET
        "status" = 'pending',
        "workflowState" = 'PENDING_SAFETY',
        "workflowActionStage" = NULL,
        "workflowActionRemarks" = NULL,
        "updatedAt" = NOW()
      WHERE id = ANY($1)
    `,
            [annualTrailerVehicleIds],
          );
        }
        let result;

        if (allReviewed) {
          result = await client.query(
            `
            UPDATE "vendor_pass_requests"
            SET
              "status" = 'VENDOR_SUBMITTED',
              "workflowState" = 'PENDING_SAFETY',
              "approvedBy" = $2,
              "updatedAt" = NOW()
            WHERE id = $1
            RETURNING *
            `,
            [vendorPassId, approvedBy],
          );
        } else {
          result = {
            rows: [row],
          };
        }

        await client.query("COMMIT");
        client.release();

        return {
          ...result.rows[0],
          reviewStatus: "PENDING_NEXT",
          message:
            "Pass Section approval completed. Vendor vehicle moved to Safety Officer.",
        };
      }

      let finalStatus = "VENDOR_SUBMITTED";
      if (allReviewed) {
        finalStatus = "COMPLETED";
      }

      const result = await client.query(
        `UPDATE "vendor_pass_requests"
         SET "status" = $1,
             "approvedBy" = $2,
             "updatedAt" = NOW()
         WHERE id = $3
         RETURNING *`,
        [finalStatus, approvedBy, vendorPassId],
      );

      await client.query("COMMIT");
      client.release();

      // Send email if COMPLETED, APPROVED, or REVERTED
      if (
        ["APPROVED", "COMPLETED", "REVERTED"].includes(finalStatus) &&
        row.vendorEmail
      ) {
        try {
          const approvedPersons = persons.filter(
            (p) => p.status === "approved",
          );
          const approvedVehicles = vehicles.filter(
            (v) => v.status === "approved",
          );
          const { encryptToken } = require("../utils/cryptoUtils");
          const encryptedToken = encryptToken(row.token);
          const qrLink =
            finalStatus === "REVERTED"
              ? `${FRONTEND_URL}/vendor_pass/${encryptedToken}`
              : `${FRONTEND_URL}/vendor_pass_approved/${encryptedToken}`;

          const formatValidUpto = (raw) => {
            if (!raw) return null;
            try {
              const d = new Date(raw);
              if (isNaN(d)) return String(raw);
              return d.toLocaleString("en-IN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata",
              });
            } catch {
              return String(raw);
            }
          };

          axios
            .post(
              `${EMAIL_SERVICE_URL}/api/email/sendVendorPassApproved`,
              {
                email: row.vendorEmail,
                companyName: row.companyName,
                referenceNo: row.referenceNo,
                qrLink: qrLink,
                approvedPersonsCount: approvedPersons.length,
                approvedVehiclesCount: approvedVehicles.length,
                validUpto: formatValidUpto(row.validUpto),
                departmentName: row.departmentName,
                finalStatus: finalStatus,
              },
              {
                headers: { "x-service-name": "USER-SERVICE" },
                timeout: 8000,
              },
            )
            .then(() => {
              console.log(
                `[VENDOR-PASS] ${finalStatus} email sent to ${row.vendorEmail} for ${row.referenceNo}`,
              );
            })
            .catch((emailError) => {
              console.error(
                `[VENDOR-PASS] Failed to send ${finalStatus} email:`,
                emailError.message,
              );
            });
        } catch (emailErr) {
          console.error(
            `[VENDOR-PASS] Failed to trigger email:`,
            emailErr.message,
          );
        }
      }

      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      client.release();
      throw error;
    }
  },

  async actionVendorOilJettyWorkflow(
    vendorPassId,
    userId,
    roleId,
    departmentId,
    entityType,
    entityId,
    decision,
    remarks = null,
  ) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const normalizedVendorPassId = Number(vendorPassId);
      const normalizedUserId = Number(userId);
      const normalizedRoleId = Number(roleId);
      const normalizedDepartmentId = Number(departmentId);
      const normalizedEntityId = Number(entityId);

      const normalizedEntityType = String(entityType || "")
        .trim()
        .toUpperCase();

      const normalizedDecision = String(decision || "")
        .trim()
        .toUpperCase();

      const normalizedRemarks =
        remarks !== null && remarks !== undefined
          ? String(remarks).trim()
          : null;

      if (
        !Number.isInteger(normalizedVendorPassId) ||
        normalizedVendorPassId <= 0
      ) {
        throw new Error("Invalid vendor pass ID.");
      }

      if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
        throw new Error("Invalid user.");
      }

      if (!Number.isInteger(normalizedRoleId) || normalizedRoleId <= 0) {
        throw new Error("Invalid role.");
      }

      if (
        !Number.isInteger(normalizedDepartmentId) ||
        normalizedDepartmentId <= 0
      ) {
        throw new Error("Invalid department.");
      }

      if (!["PERSON", "VEHICLE"].includes(normalizedEntityType)) {
        throw new Error(
          "Invalid Vendor Oil-Jetty entity type. Use PERSON or VEHICLE.",
        );
      }

      if (!Number.isInteger(normalizedEntityId) || normalizedEntityId <= 0) {
        throw new Error("Invalid Vendor Oil-Jetty entity ID.");
      }

      if (!["APPROVED", "REJECTED", "REVERTED"].includes(normalizedDecision)) {
        throw new Error(
          "Invalid decision. Allowed values are APPROVED, REJECTED and REVERTED.",
        );
      }

      if (
        ["REJECTED", "REVERTED"].includes(normalizedDecision) &&
        !normalizedRemarks
      ) {
        throw new Error(
          normalizedDecision === "REVERTED"
            ? "Revert reason is required."
            : "Rejection reason is required.",
        );
      }

      /*
       * ==========================================================
       * 1. LOCK PARENT REQUEST
       * ==========================================================
       */

      const requestRes = await client.query(
        `
        SELECT
          id,
          "referenceNo",
          "token",
          "vendorEmail",
          "companyName",
          "validUpto",
          "departmentId",
          "departmentName",
          "isOilDock",
          status,
          "workflowState",
          "workflowActionStage",
          "workflowActionRemarks"
        FROM "vendor_pass_requests"
        WHERE id = $1
        FOR UPDATE
      `,
        [normalizedVendorPassId],
      );

      if (requestRes.rows.length === 0) {
        throw new Error("Vendor pass request not found.");
      }

      const request = requestRes.rows[0];

      if (request.isOilDock !== true) {
        throw new Error("This request is not a Vendor Oil-Jetty request.");
      }

      /*
       * ==========================================================
       * 2. LOAD ONLY THE REQUESTED ENTITY
       *
       * IMPORTANT:
       * Never decide person routing from vendor_pass_requests.workflowState.
       * Never decide vehicle routing from person rows.
       * ==========================================================
       */

      let entity = null;

      if (normalizedEntityType === "PERSON") {
        const personRes = await client.query(
          `
          SELECT
            id,
            "vendorPassRequestId",
            status,
            "concernDepartmentId",
            "accessAreaId",
            "workflowState",
            "workflowActionStage",
            "workflowActionRemarks"
          FROM "vendor_pass_persons"
          WHERE id = $1
            AND "vendorPassRequestId" = $2
          FOR UPDATE
        `,
          [normalizedEntityId, normalizedVendorPassId],
        );

        entity = personRes.rows[0] || null;

        if (!entity) {
          throw new Error("Vendor person not found for this request.");
        }
      } else {
        const vehicleRes = await client.query(
          `
          SELECT
            id,
            "vendorPassRequestId",
            status,
            "concernDepartmentId",
            "accessAreaId",
            "workflowState",
            "workflowActionStage",
            "workflowActionRemarks"
          FROM "vendor_pass_vehicles"
          WHERE id = $1
            AND "vendorPassRequestId" = $2
          FOR UPDATE
        `,
          [normalizedEntityId, normalizedVendorPassId],
        );

        entity = vehicleRes.rows[0] || null;

        if (!entity) {
          throw new Error("Vendor vehicle not found for this request.");
        }
      }

      /*
       * ==========================================================
       * 3. VERIFY THIS ENTITY IS OIL-JETTY
       * ==========================================================
       */

      const entityArea = String(entity.accessAreaId || "")
        .trim()
        .toUpperCase();

      const isOilJettyEntity =
        entityArea === "1" ||
        entityArea.includes("OIL JETTY") ||
        entityArea.includes("OIL_JETTY");

      if (!isOilJettyEntity) {
        throw new Error("This entity is not an Oil-Jetty entity.");
      }

      const currentWorkflowState = String(entity.workflowState || "")
        .trim()
        .toUpperCase();

      let currentStage = null;
      let nextWorkflowState = null;

      /*
       * ==========================================================
       * 4. PERSON WORKFLOW
       *
       * Civil / Mechanical -> Traffic
       *
       * NO Marine
       * NO Fire Safety
       * NO CISF
       * ==========================================================
       */

      if (normalizedEntityType === "PERSON") {
        const selectedDepartment = Number(entity.concernDepartmentId);

        const isConcernApprover =
          normalizedRoleId === 4 && [3, 4].includes(normalizedDepartmentId);

        const isTrafficApprover =
          (normalizedRoleId === 4 || normalizedRoleId === 26) &&
          normalizedDepartmentId === 9;

        if (
          currentWorkflowState === "PENDING_VENDOR_PERSON_CONCERN_DEPARTMENT"
        ) {
          if (!isConcernApprover) {
            throw new Error(
              "You are not authorized for this Vendor person concern department stage.",
            );
          }

          if (selectedDepartment !== normalizedDepartmentId) {
            throw new Error(
              "You are not authorized to approve this Vendor person because the selected concern department is different.",
            );
          }

          currentStage = "PERSON_CONCERN_DEPARTMENT";

          nextWorkflowState = "PENDING_VENDOR_PERSON_TRAFFIC";
        } else if (currentWorkflowState === "PENDING_VENDOR_PERSON_TRAFFIC") {
          if (!isTrafficApprover) {
            throw new Error(
              "You are not authorized for this Vendor person Traffic stage.",
            );
          }

          currentStage = "PERSON_TRAFFIC";
          nextWorkflowState = "COMPLETED";
        } else {
          throw new Error(
            `Invalid Vendor person workflow state: ${
              currentWorkflowState || "EMPTY"
            }`,
          );
        }
      }

      /*
       * ==========================================================
       * 5. VEHICLE WORKFLOW
       *
       * Marine -> Concern/CISF -> Traffic
       *
       * EXISTING VEHICLE WORKFLOW ONLY
       * ==========================================================
       */

      if (normalizedEntityType === "VEHICLE") {
        const selectedDepartment = Number(entity.concernDepartmentId);

        const isMarineApprover =
          normalizedDepartmentId === 7 && [27, 29].includes(normalizedRoleId);

        const isConcernApprover =
          normalizedRoleId === 4 && [3, 4].includes(normalizedDepartmentId);

        const isCisfApprover =
          normalizedDepartmentId === 1 && normalizedRoleId === 30;

        const isTrafficApprover =
          normalizedDepartmentId === 9 && normalizedRoleId === 4;

        if (currentWorkflowState === "PENDING_VENDOR_MARINE") {
          if (!isMarineApprover) {
            throw new Error(
              "You are not authorized for this Vendor vehicle Marine stage.",
            );
          }

          if (selectedDepartment === 9) {
            currentStage = "MARINE";
            nextWorkflowState = "PENDING_VENDOR_CISF";
          } else if (selectedDepartment === 3 || selectedDepartment === 4) {
            currentStage = "MARINE";
            nextWorkflowState = "PENDING_VENDOR_CONCERN_DEPARTMENT";
          } else {
            throw new Error(
              "Invalid concern department for Vendor Oil-Jetty vehicle.",
            );
          }
        } else if (
          currentWorkflowState === "PENDING_VENDOR_CONCERN_DEPARTMENT"
        ) {
          if (!isConcernApprover) {
            throw new Error(
              "You are not authorized for this Vendor vehicle concern department stage.",
            );
          }

          if (selectedDepartment !== normalizedDepartmentId) {
            throw new Error(
              "You are not authorized to approve this Vendor vehicle because the selected concern department is different.",
            );
          }

          currentStage = "CONCERN_DEPARTMENT";

          nextWorkflowState = "PENDING_VENDOR_CISF";
        } else if (currentWorkflowState === "PENDING_VENDOR_CISF") {
          if (!isCisfApprover) {
            throw new Error(
              "You are not authorized for this Vendor vehicle CISF stage.",
            );
          }

          currentStage = "CISF";
          nextWorkflowState = "PENDING_VENDOR_TRAFFIC";
        } else if (currentWorkflowState === "PENDING_VENDOR_TRAFFIC") {
          if (!isTrafficApprover) {
            throw new Error(
              "You are not authorized for this Vendor vehicle Traffic stage.",
            );
          }

          currentStage = "TRAFFIC";
          nextWorkflowState = "COMPLETED";
        } else {
          throw new Error(
            `Invalid Vendor vehicle workflow state: ${
              currentWorkflowState || "EMPTY"
            }`,
          );
        }
      }

      /*
       * ==========================================================
       * 6. ACTING USER
       * ==========================================================
       */

      const userRes = await client.query(
        `
        SELECT "userName"
        FROM "users"
        WHERE id = $1
      `,
        [normalizedUserId],
      );

      const actedByUserName =
        userRes.rows[0]?.userName || `User ${normalizedUserId}`;

      const targetTable =
        normalizedEntityType === "PERSON"
          ? "vendor_pass_persons"
          : "vendor_pass_vehicles";

      /*
       * ==========================================================
       * 7. APPLY DECISION TO ONLY THIS ENTITY
       * ==========================================================
       */

      let resultingWorkflowState;
      let resultingStatus;

      if (normalizedDecision === "REJECTED") {
        resultingWorkflowState = "REJECTED";
        resultingStatus = "rejected";

        await client.query(
          `
          UPDATE "${targetTable}"
          SET
            "status" = 'rejected',
            "workflowState" = 'REJECTED',
            "workflowActionStage" = $3,
            "workflowActionRemarks" = $4,
            "rejectedReason" = $5,
            "updatedAt" = NOW()
          WHERE id = $1
            AND "vendorPassRequestId" = $2
        `,
          [
            normalizedEntityId,
            normalizedVendorPassId,
            currentStage,
            normalizedRemarks,
            normalizedRemarks,
          ],
        );
      } else if (normalizedDecision === "REVERTED") {
        resultingWorkflowState = "REVERTED";
        resultingStatus = "reverted";

        await client.query(
          `
          UPDATE "${targetTable}"
          SET
            "status" = 'reverted',
            "workflowState" = 'REVERTED',
            "workflowActionStage" = $3,
            "workflowActionRemarks" = $4,
            "revertReason" = $5,
            "isReverted" = true,
            "lastRevertReason" = $5,
            "updatedAt" = NOW()
          WHERE id = $1
            AND "vendorPassRequestId" = $2
        `,
          [
            normalizedEntityId,
            normalizedVendorPassId,
            currentStage,
            normalizedRemarks,
            normalizedRemarks,
          ],
        );
      } else {
        resultingWorkflowState = nextWorkflowState;

        /*
         * Intermediate approval:
         * entity is still pending because it has another stage.
         *
         * Final Traffic approval:
         * entity becomes approved.
         */
        resultingStatus =
          nextWorkflowState === "COMPLETED" ? "approved" : "pending";

        await client.query(
          `
          UPDATE "${targetTable}"
          SET
            "status" = $3,
            "workflowState" = $4,
            "workflowActionStage" = $5,
            "workflowActionRemarks" = $6,
            "isReverted" = false,
            "updatedAt" = NOW()
          WHERE id = $1
            AND "vendorPassRequestId" = $2
        `,
          [
            normalizedEntityId,
            normalizedVendorPassId,
            resultingStatus,
            resultingWorkflowState,
            currentStage,
            normalizedRemarks,
          ],
        );
      }

      /*
       * ==========================================================
       * 8. AUDIT HISTORY
       *
       * Keep existing history table.
       * The actual entity is preserved in the remark.
       * ==========================================================
       */

      const historyRemark = [
        `${normalizedEntityType} ID: ${normalizedEntityId}`,
        normalizedRemarks || "",
      ]
        .filter(Boolean)
        .join(" | ");

      await client.query(
        `
        INSERT INTO "vendor_oil_jetty_workflow_history"
        (
          "vendorPassRequestId",
          "stage",
          "departmentId",
          "roleId",
          "action",
          "actedByUserId",
          "actedByUserName",
          "remarks",
          "createdAt",
          "updatedAt"
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
      `,
        [
          normalizedVendorPassId,
          currentStage,
          normalizedDepartmentId,
          normalizedRoleId,
          normalizedDecision,
          normalizedUserId,
          actedByUserName,
          historyRemark || null,
        ],
      );

      /*
       * ==========================================================
       * 9. UPDATE PARENT ONLY WHEN ALL ENTITIES ARE FINISHED
       *
       * This prevents one person's approval from completing
       * a request while its vehicle is still in workflow.
       * ==========================================================
       */

      const entityStateRes = await client.query(
        `
        SELECT
          "workflowState"
        FROM "vendor_pass_persons"
        WHERE "vendorPassRequestId" = $1

        UNION ALL

        SELECT
          "workflowState"
        FROM "vendor_pass_vehicles"
        WHERE "vendorPassRequestId" = $1
      `,
        [normalizedVendorPassId],
      );

      const entityStates = entityStateRes.rows.map((row) =>
        String(row.workflowState || "")
          .trim()
          .toUpperCase(),
      );

      const allEntitiesFinished =
        entityStates.length > 0 &&
        entityStates.every((state) =>
          ["COMPLETED", "REJECTED"].includes(state),
        );

      const anyEntityRejected = entityStates.includes("REJECTED");

      let parentStatus = request.status;

      if (allEntitiesFinished) {
        parentStatus = anyEntityRejected ? "REJECTED" : "COMPLETED";

        await client.query(
          `
    UPDATE "vendor_pass_requests"
    SET
      "status" = $2,
      "workflowState" = $3,
      "workflowActionStage" = $4,
      "workflowActionRemarks" = $5,
      "approvedBy" = $6,
      "updatedAt" = NOW()
    WHERE id = $1
  `,
          [
            normalizedVendorPassId,
            parentStatus,
            parentStatus,
            currentStage,
            normalizedRemarks,
            actedByUserName,
          ],
        );
      }

      await client.query("COMMIT");
      /*
       * ==========================================================
       * 10. SEND ENTITY-SPECIFIC APPROVAL EMAIL
       *
       * Person and vehicle are independent.
       * Email must be sent immediately when THAT entity
       * reaches COMPLETED, even if the parent request is
       * still waiting for the other entity.
       * ==========================================================
       */
      if (
        normalizedDecision === "APPROVED" &&
        resultingWorkflowState === "COMPLETED" &&
        request.vendorEmail
      ) {
        try {
          const { encryptToken } = require("../utils/cryptoUtils");

          const encryptedToken = encryptToken(request.token);

          const entityTypeForUrl =
            normalizedEntityType === "PERSON" ? "person" : "vehicle";

          const qrLink =
            `${FRONTEND_URL}/vendor_pass_approved/${encryptedToken}` +
            `?type=${entityTypeForUrl}&entityId=${normalizedEntityId}`;

          await axios.post(
            `${EMAIL_SERVICE_URL}/api/email/sendVendorPassApproved`,
            {
              email: request.vendorEmail,
              companyName: request.companyName,
              referenceNo: request.referenceNo,
              qrLink,
              approvedPersonsCount: normalizedEntityType === "PERSON" ? 1 : 0,
              approvedVehiclesCount: normalizedEntityType === "VEHICLE" ? 1 : 0,
              validUpto: request.validUpto,
              departmentName: request.departmentName,
              finalStatus: "ENTITY_APPROVED",
              entityType: normalizedEntityType,
              entityId: normalizedEntityId,
            },
            {
              headers: { "x-service-name": "USER-SERVICE" },
              timeout: 8000,
            },
          );

          console.log(
            `[VENDOR-PASS] ${normalizedEntityType} approval email sent for ${request.referenceNo}, entityId=${normalizedEntityId}`,
          );
        } catch (emailError) {
          console.error(
            `[VENDOR-PASS] Failed to send ${normalizedEntityType} approval email:`,
            emailError.response?.data || emailError.message,
          );
        }
      }

      return {
        id: normalizedEntityId,
        entityType: normalizedEntityType,
        entityStatus: resultingStatus,
        workflowState: resultingWorkflowState,
        workflowStage: currentStage,
        nextWorkflowState,
        parentStatus,
        reviewStatus: allEntitiesFinished ? parentStatus : "PENDING_NEXT",
        message:
          normalizedDecision === "REJECTED"
            ? `Vendor Oil-Jetty ${normalizedEntityType.toLowerCase()} request rejected.`
            : normalizedDecision === "REVERTED"
              ? `Vendor Oil-Jetty ${normalizedEntityType.toLowerCase()} request reverted.`
              : resultingWorkflowState === "COMPLETED"
                ? `Vendor Oil-Jetty ${normalizedEntityType.toLowerCase()} workflow completed.`
                : `Vendor Oil-Jetty ${normalizedEntityType.toLowerCase()} workflow moved to the next stage.`,
      };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Vendor Oil-Jetty workflow rollback failed:",
          rollbackError,
        );
      }

      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = VendorPassRequest;

// async actionVendorOilJettyWorkflow(
//     vendorPassId,
//     userId,
//     roleId,
//     departmentId,
//     entityType,
//     entityId,
//     decision,
//     remarks = null,
//   ) {
//     const client = await pool.connect();

//     try {
//       await client.query("BEGIN");
//       const rawVendorPassId = Number(vendorPassId);

//       const personOilJettyRes = await client.query(
//         `
//     SELECT
//       id,
//       status,
//       "concernDepartmentId"
//     FROM "vendor_pass_persons"
//     WHERE "vendorPassRequestId" = $1
//       AND (
//         "accessAreaId"::TEXT = '1'
//         OR "accessAreaId"::TEXT ILIKE '%OIL%JETTY%'
//         OR "accessAreaId"::TEXT ILIKE '%OIL_JETTY%'
//       )
//   `,
//         [rawVendorPassId],
//       );

//       const vehicleOilJettyRes = await client.query(
//         `
//     SELECT id
//     FROM "vendor_pass_vehicles"
//     WHERE "vendorPassRequestId" = $1
//       AND (
//         "accessAreaId"::TEXT = '1'
//         OR "accessAreaId"::TEXT ILIKE '%OIL%JETTY%'
//         OR "accessAreaId"::TEXT ILIKE '%OIL_JETTY%'
//       )
//   `,
//         [rawVendorPassId],
//       );

//       const allVehicleRes = await client.query(
//         `
//     SELECT id
//     FROM "vendor_pass_vehicles"
//     WHERE "vendorPassRequestId" = $1
//   `,
//         [rawVendorPassId],
//       );

//       const isVendorPersonOilJettyOnly =
//         personOilJettyRes.rows.length > 0 && allVehicleRes.rows.length === 0;

//       if (isVendorPersonOilJettyOnly) {
//         const normalizedVendorPassId = Number(vendorPassId);
//         const normalizedUserId = Number(userId);
//         const normalizedRoleId = Number(roleId);
//         const normalizedDepartmentId = Number(departmentId);

//         const normalizedDecision = String(decision || "")
//           .trim()
//           .toUpperCase();

//         const normalizedRemarks =
//           remarks !== null && remarks !== undefined
//             ? String(remarks).trim()
//             : null;

//         if (
//           !["APPROVED", "REJECTED", "REVERTED"].includes(normalizedDecision)
//         ) {
//           throw new Error(
//             "Invalid decision. Allowed values are APPROVED, REJECTED and REVERTED.",
//           );
//         }

//         if (
//           ["REJECTED", "REVERTED"].includes(normalizedDecision) &&
//           !normalizedRemarks
//         ) {
//           throw new Error(
//             normalizedDecision === "REVERTED"
//               ? "Revert reason is required."
//               : "Rejection reason is required.",
//           );
//         }

//         const personDepartmentIds = [
//           ...new Set(
//             personOilJettyRes.rows.map((row) =>
//               Number(row.concernDepartmentId),
//             ),
//           ),
//         ];

//         if (personDepartmentIds.length !== 1) {
//           throw new Error(
//             "Vendor person Oil-Jetty workflow requires exactly one concern department.",
//           );
//         }

//         const selectedConcernDepartmentId = personDepartmentIds[0];

//         if (![3, 4, 9].includes(selectedConcernDepartmentId)) {
//           throw new Error(
//             "Invalid concern department for Vendor Oil-Jetty person workflow.",
//           );
//         }

//         const requestRes = await client.query(
//           `
//       SELECT
//         id,
//         "referenceNo",
//         "token",
//         "vendorEmail",
//         "companyName",
//         "validUpto",
//         "departmentName",
//         "isOilDock",
//         status,
//         "workflowState",
//         "workflowActionStage"
//       FROM "vendor_pass_requests"
//       WHERE id = $1
//       FOR UPDATE
//     `,
//           [normalizedVendorPassId],
//         );

//         if (requestRes.rows.length === 0) {
//           throw new Error("Vendor pass request not found.");
//         }

//         const request = requestRes.rows[0];

//         if (request.isOilDock !== true) {
//           throw new Error("This request is not a Vendor Oil-Jetty request.");
//         }

//         const currentWorkflowState = String(request.workflowState || "").trim();

//         let currentStage = null;
//         let expectedWorkflowState = null;
//         let nextWorkflowState = null;

//         // const isConcernApprover =
//         //   normalizedRoleId === 4 && [3, 4].includes(normalizedDepartmentId);

//         // const isTrafficApprover =
//         //   normalizedRoleId === 4 && normalizedDepartmentId === 9;

//         const isPersonConcernApprover =
//           normalizedRoleId === 4 && [3, 4].includes(normalizedDepartmentId);

//         const isPersonTrafficApprover =
//           (normalizedRoleId === 4 || normalizedRoleId === 26) &&
//           normalizedDepartmentId === 9;

//         if (
//           currentWorkflowState === "PENDING_VENDOR_PERSON_CONCERN_DEPARTMENT"
//         ) {
//           /*
//            * Civil / Mechanical is the current approval stage.
//            *
//            * The logged-in department must match the department
//            * selected by the vendor.
//            */
//           if (!isPersonConcernApprover) {
//             throw new Error(
//               "You are not authorized for the Vendor person Oil-Jetty concern department stage.",
//             );
//           }

//           if (selectedConcernDepartmentId !== normalizedDepartmentId) {
//             throw new Error(
//               "You are not authorized to approve this Vendor person request because the selected concern department is different.",
//             );
//           }

//           currentStage = "PERSON_CONCERN_DEPARTMENT";

//           expectedWorkflowState = "PENDING_VENDOR_PERSON_CONCERN_DEPARTMENT";

//           nextWorkflowState = "PENDING_VENDOR_PERSON_TRAFFIC";
//         } else if (currentWorkflowState === "PENDING_VENDOR_PERSON_TRAFFIC") {
//           /*
//            * Traffic / Pass Section is now the CURRENT stage.
//            *
//            * IMPORTANT:
//            * Do NOT check selectedConcernDepartmentId here.
//            *
//            * The vendor's selected concern department may still be
//            * Civil (3) or Mechanical (4). That department was already
//            * approved in the previous stage.
//            *
//            * Traffic department 9 is now the authority.
//            *
//            * roleId 4  = Approval
//            * roleId 26 = Safety Officer (Traffic account, as configured)
//            */
//           if (!isPersonTrafficApprover) {
//             throw new Error(
//               "You are not authorized for the Vendor person Oil-Jetty Traffic / Pass Section stage.",
//             );
//           }

//           currentStage = "PERSON_TRAFFIC";

//           expectedWorkflowState = "PENDING_VENDOR_PERSON_TRAFFIC";

//           nextWorkflowState = "COMPLETED";
//         } else {
//           throw new Error(
//             `Invalid Vendor person Oil-Jetty workflow state: ${currentWorkflowState}`,
//           );
//         }

//         // if ([3, 4].includes(selectedConcernDepartmentId)) {
//         //   if (!isConcernApprover) {
//         //     throw new Error(
//         //       "You are not authorized for this Vendor Oil-Jetty person workflow.",
//         //     );
//         //   }

//         //   if (selectedConcernDepartmentId !== normalizedDepartmentId) {
//         //     throw new Error(
//         //       "You are not authorized to approve this Vendor person request because the selected concern department is different.",
//         //     );
//         //   }

//         //   currentStage = "PERSON_CONCERN_DEPARTMENT";
//         //   expectedWorkflowState = "PENDING_VENDOR_PERSON_CONCERN_DEPARTMENT";
//         //   nextWorkflowState = "PENDING_VENDOR_PERSON_TRAFFIC";
//         // } else if (selectedConcernDepartmentId === 9) {
//         //   if (!isTrafficApprover) {
//         //     throw new Error(
//         //       "Only Traffic / Pass Section can approve this Vendor person request.",
//         //     );
//         //   }

//         //   currentStage = "PERSON_TRAFFIC";
//         //   expectedWorkflowState = "PENDING_VENDOR_PERSON_TRAFFIC";
//         //   nextWorkflowState = "COMPLETED";
//         // }

//         if (currentWorkflowState !== expectedWorkflowState) {
//           throw new Error(
//             `This Vendor person request is not awaiting ${currentStage}. Current state: ${currentWorkflowState}`,
//           );
//         }

//         const userRes = await client.query(
//           `
//       SELECT "userName"
//       FROM "users"
//       WHERE id = $1
//     `,
//           [normalizedUserId],
//         );

//         const actedByUserName =
//           userRes.rows[0]?.userName || `User ${normalizedUserId}`;

//         // REJECT
//         if (normalizedDecision === "REJECTED") {
//           await client.query(
//             `
//         UPDATE "vendor_pass_persons"
//         SET
//           "status" = 'rejected',
//           "rejectedReason" = $2,
//           "updatedAt" = NOW()
//         WHERE "vendorPassRequestId" = $1
//           AND "status" != 'rejected'
//       `,
//             [normalizedVendorPassId, normalizedRemarks],
//           );

//           const result = await client.query(
//             `
//         UPDATE "vendor_pass_requests"
//         SET
//           "status" = 'REJECTED',
//           "workflowState" = 'REJECTED',
//           "workflowActionStage" = $2,
//           "workflowActionRemarks" = $3,
//           "approvedBy" = $4,
//           "updatedAt" = NOW()
//         WHERE id = $1
//         RETURNING *
//       `,
//             [
//               normalizedVendorPassId,
//               currentStage,
//               normalizedRemarks,
//               actedByUserName,
//             ],
//           );

//           await client.query(
//             `
//         INSERT INTO "vendor_oil_jetty_workflow_history"
//         (
//           "vendorPassRequestId",
//           "stage",
//           "departmentId",
//           "roleId",
//           "action",
//           "actedByUserId",
//           "actedByUserName",
//           "remarks",
//           "createdAt",
//           "updatedAt"
//         )
//         VALUES
//         ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
//       `,
//             [
//               normalizedVendorPassId,
//               currentStage,
//               normalizedDepartmentId,
//               normalizedRoleId,
//               "REJECTED",
//               normalizedUserId,
//               actedByUserName,
//               normalizedRemarks,
//             ],
//           );

//           await client.query("COMMIT");

//           return {
//             ...result.rows[0],
//             reviewStatus: "REJECTED",
//             workflowStage: currentStage,
//             message: "Vendor Oil-Jetty person request rejected.",
//           };
//         }

//         // REVERT
//         if (normalizedDecision === "REVERTED") {
//           await client.query(
//             `
//         UPDATE "vendor_pass_persons"
//         SET
//           "status" = 'reverted',
//           "revertReason" = $2,
//           "isReverted" = true,
//           "lastRevertReason" = $2,
//           "updatedAt" = NOW()
//         WHERE "vendorPassRequestId" = $1
//           AND "status" != 'rejected'
//       `,
//             [normalizedVendorPassId, normalizedRemarks],
//           );

//           const result = await client.query(
//             `
//         UPDATE "vendor_pass_requests"
//         SET
//           "status" = 'REVERTED',
//           "workflowState" = 'REVERTED',
//           "workflowActionStage" = $2,
//           "workflowActionRemarks" = $3,
//           "approvedBy" = $4,
//           "updatedAt" = NOW()
//         WHERE id = $1
//         RETURNING *
//       `,
//             [
//               normalizedVendorPassId,
//               currentStage,
//               normalizedRemarks,
//               actedByUserName,
//             ],
//           );

//           await client.query(
//             `
//         INSERT INTO "vendor_oil_jetty_workflow_history"
//         (
//           "vendorPassRequestId",
//           "stage",
//           "departmentId",
//           "roleId",
//           "action",
//           "actedByUserId",
//           "actedByUserName",
//           "remarks",
//           "createdAt",
//           "updatedAt"
//         )
//         VALUES
//         ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
//       `,
//             [
//               normalizedVendorPassId,
//               currentStage,
//               normalizedDepartmentId,
//               normalizedRoleId,
//               "REVERTED",
//               normalizedUserId,
//               actedByUserName,
//               normalizedRemarks,
//             ],
//           );

//           await client.query("COMMIT");

//           return {
//             ...result.rows[0],
//             reviewStatus: "REVERTED",
//             workflowStage: currentStage,
//             message: "Vendor Oil-Jetty person request reverted to vendor.",
//           };
//         }

//         // APPROVE
//         if (currentStage === "PERSON_TRAFFIC") {
//           await client.query(
//             `
//         UPDATE "vendor_pass_persons"
//         SET
//           "status" = 'approved',
//           "updatedAt" = NOW()
//         WHERE "vendorPassRequestId" = $1
//           AND "status" != 'rejected'
//       `,
//             [normalizedVendorPassId],
//           );
//         }

//         const result = await client.query(
//           `
//       UPDATE "vendor_pass_requests"
//       SET
//         "status" = 'VENDOR_SUBMITTED',
//         "workflowState" = $2,
//         "workflowActionStage" = $3,
//         "workflowActionRemarks" = $4,
//         "approvedBy" = $5,
//         "updatedAt" = NOW()
//       WHERE id = $1
//       RETURNING *
//     `,
//           [
//             normalizedVendorPassId,
//             nextWorkflowState,
//             currentStage,
//             normalizedRemarks,
//             actedByUserName,
//           ],
//         );

//         await client.query(
//           `
//       INSERT INTO "vendor_oil_jetty_workflow_history"
//       (
//         "vendorPassRequestId",
//         "stage",
//         "departmentId",
//         "roleId",
//         "action",
//         "actedByUserId",
//         "actedByUserName",
//         "remarks",
//         "createdAt",
//         "updatedAt"
//       )
//       VALUES
//       ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
//     `,
//           [
//             normalizedVendorPassId,
//             currentStage,
//             normalizedDepartmentId,
//             normalizedRoleId,
//             "APPROVED",
//             normalizedUserId,
//             actedByUserName,
//             normalizedRemarks,
//           ],
//         );

//         await client.query("COMMIT");

//         return {
//           ...result.rows[0],
//           reviewStatus: "PENDING_NEXT",
//           workflowStage: currentStage,
//           nextWorkflowState,
//           message: "Vendor Oil-Jetty person workflow moved to the next stage.",
//         };
//       }

//       const concernDeptRes = await client.query(
//         `
//           SELECT DISTINCT "concernDepartmentId"
//           FROM "vendor_pass_vehicles"
//           WHERE "vendorPassRequestId" = $1
//             AND "concernDepartmentId" IS NOT NULL
//             AND (
//               "accessAreaId"::TEXT = '1'
//               OR "accessAreaId"::TEXT ILIKE '%OIL%JETTY%'
//               OR "accessAreaId"::TEXT ILIKE '%OIL_JETTY%'
//             )
//         `,
//         [vendorPassId],
//       );

//       const concernDepartmentIds = concernDeptRes.rows.map((row) =>
//         Number(row.concernDepartmentId),
//       );
//       if (concernDepartmentIds.length !== 1) {
//         throw new Error(
//           "Vendor Oil-Jetty workflow requires exactly one concern department.",
//         );
//       }

//       const selectedConcernDepartmentId = concernDepartmentIds[0];

//       if (![3, 4, 9].includes(selectedConcernDepartmentId)) {
//         throw new Error(
//           "Invalid concern department for Vendor Oil-Jetty workflow.",
//         );
//       }

//       /*
//        * ==========================================================
//        * 1. Validate input
//        * ==========================================================
//        */
//       const normalizedVendorPassId = Number(vendorPassId);
//       const normalizedUserId = Number(userId);
//       const normalizedRoleId = Number(roleId);
//       const normalizedDepartmentId = Number(departmentId);
//       const normalizedEntityId = Number(entityId);

//       const normalizedEntityType = String(entityType || "")
//         .trim()
//         .toUpperCase();

//       const normalizedDecision = String(decision || "")
//         .trim()
//         .toUpperCase();

//       const normalizedRemarks =
//         remarks !== null && remarks !== undefined
//           ? String(remarks).trim()
//           : null;

//       if (!["PERSON", "VEHICLE"].includes(normalizedEntityType)) {
//         throw new Error("Invalid Vendor Oil-Jetty entity type.");
//       }

//       if (!Number.isInteger(normalizedEntityId) || normalizedEntityId <= 0) {
//         throw new Error("Invalid Vendor Oil-Jetty entity ID.");
//       }

//       if (!["APPROVED", "REJECTED", "REVERTED"].includes(normalizedDecision)) {
//         throw new Error(
//           "Invalid decision. Allowed values are APPROVED, REJECTED and REVERTED.",
//         );
//       }

//       if (
//         ["REJECTED", "REVERTED"].includes(normalizedDecision) &&
//         !normalizedRemarks
//       ) {
//         throw new Error(
//           normalizedDecision === "REVERTED"
//             ? "Revert reason is required."
//             : "Rejection reason is required.",
//         );
//       }

//       const requestRes = await client.query(
//         `
//     SELECT
//       id,
//       "referenceNo",
//       "token",
//       "vendorEmail",
//       "companyName",
//       "validUpto",
//       "departmentId",
//       "departmentName",
//       "isOilDock",
//       status,
//       "workflowState",
//       "workflowActionStage",
//       "workflowActionRemarks"
//     FROM "vendor_pass_requests"
//     WHERE id = $1
//     FOR UPDATE
//   `,
//         [normalizedVendorPassId],
//       );

//       if (requestRes.rows.length === 0) {
//         throw new Error("Vendor pass request not found.");
//       }

//       const request = requestRes.rows[0];

//       if (request.isOilDock !== true) {
//         throw new Error("This request is not a Vendor Oil-Jetty request.");
//       }

//       let entity;

//       if (normalizedEntityType === "PERSON") {
//         const result = await client.query(
//           `
//       SELECT
//         id,
//         "vendorPassRequestId",
//         status,
//         "concernDepartmentId",
//         "workflowState",
//         "workflowActionStage",
//         "workflowActionRemarks"
//       FROM "vendor_pass_persons"
//       WHERE id = $1
//         AND "vendorPassRequestId" = $2
//       FOR UPDATE
//     `,
//           [normalizedEntityId, normalizedVendorPassId],
//         );

//         entity = result.rows[0];

//         if (!entity) {
//           throw new Error("Vendor person not found for this request.");
//         }
//       } else {
//         const result = await client.query(
//           `
//       SELECT
//         id,
//         "vendorPassRequestId",
//         status,
//         "concernDepartmentId",
//         "workflowState",
//         "workflowActionStage",
//         "workflowActionRemarks"
//       FROM "vendor_pass_vehicles"
//       WHERE id = $1
//         AND "vendorPassRequestId" = $2
//       FOR UPDATE
//     `,
//           [normalizedEntityId, normalizedVendorPassId],
//         );

//         entity = result.rows[0];

//         if (!entity) {
//           throw new Error("Vendor vehicle not found for this request.");
//         }
//       }

//       const currentWorkflowState = String(entity.workflowState || "")
//         .trim()
//         .toUpperCase();

//       // let currentStage;
//       // let nextWorkflowState;

//       if (normalizedEntityType === "PERSON") {
//         const selectedDepartment = Number(entity.concernDepartmentId);

//         const isConcernApprover =
//           normalizedRoleId === 4 && [3, 4].includes(normalizedDepartmentId);

//         const isTrafficApprover =
//           (normalizedRoleId === 4 || normalizedRoleId === 26) &&
//           normalizedDepartmentId === 9;

//         if (
//           currentWorkflowState === "PENDING_VENDOR_PERSON_CONCERN_DEPARTMENT"
//         ) {
//           if (!isConcernApprover) {
//             throw new Error(
//               "You are not authorized for this Vendor person concern department stage.",
//             );
//           }

//           if (selectedDepartment !== normalizedDepartmentId) {
//             throw new Error(
//               "You are not authorized to approve this Vendor person because the selected concern department is different.",
//             );
//           }

//           currentStage = "PERSON_CONCERN_DEPARTMENT";

//           nextWorkflowState = "PENDING_VENDOR_PERSON_TRAFFIC";
//         } else if (currentWorkflowState === "PENDING_VENDOR_PERSON_TRAFFIC") {
//           if (!isTrafficApprover) {
//             throw new Error(
//               "You are not authorized for this Vendor person Traffic stage.",
//             );
//           }

//           currentStage = "PERSON_TRAFFIC";

//           nextWorkflowState = "COMPLETED";
//         } else {
//           throw new Error(
//             `Invalid Vendor person workflow state: ${currentWorkflowState}`,
//           );
//         }
//       } else {
//         const selectedDepartment = Number(entity.concernDepartmentId);

//         const isMarineApprover =
//           normalizedDepartmentId === 7 && [27, 29].includes(normalizedRoleId);

//         const isConcernApprover =
//           normalizedRoleId === 4 && [3, 4].includes(normalizedDepartmentId);

//         const isCisfApprover =
//           normalizedDepartmentId === 1 && normalizedRoleId === 30;

//         const isTrafficApprover =
//           normalizedDepartmentId === 9 && normalizedRoleId === 4;

//         if (currentWorkflowState === "PENDING_VENDOR_MARINE") {
//           if (!isMarineApprover) {
//             throw new Error(
//               "You are not authorized for this Vendor vehicle Marine stage.",
//             );
//           }

//           if (selectedDepartment === 9) {
//             currentStage = "MARINE";
//             nextWorkflowState = "PENDING_VENDOR_CISF";
//           } else if (selectedDepartment === 3 || selectedDepartment === 4) {
//             currentStage = "MARINE";
//             nextWorkflowState = "PENDING_VENDOR_CONCERN_DEPARTMENT";
//           } else {
//             throw new Error(
//               "Invalid concern department for Vendor Oil-Jetty vehicle.",
//             );
//           }
//         } else if (
//           currentWorkflowState === "PENDING_VENDOR_CONCERN_DEPARTMENT"
//         ) {
//           if (!isConcernApprover) {
//             throw new Error(
//               "You are not authorized for this Vendor vehicle concern department stage.",
//             );
//           }

//           if (selectedDepartment !== normalizedDepartmentId) {
//             throw new Error(
//               "You are not authorized to approve this Vendor vehicle because the selected concern department is different.",
//             );
//           }

//           currentStage = "CONCERN_DEPARTMENT";

//           nextWorkflowState = "PENDING_VENDOR_CISF";
//         } else if (currentWorkflowState === "PENDING_VENDOR_CISF") {
//           if (!isCisfApprover) {
//             throw new Error(
//               "You are not authorized for this Vendor vehicle CISF stage.",
//             );
//           }

//           currentStage = "CISF";

//           nextWorkflowState = "PENDING_VENDOR_TRAFFIC";
//         } else if (currentWorkflowState === "PENDING_VENDOR_TRAFFIC") {
//           if (!isTrafficApprover) {
//             throw new Error(
//               "You are not authorized for this Vendor vehicle Traffic stage.",
//             );
//           }

//           currentStage = "TRAFFIC";

//           nextWorkflowState = "COMPLETED";
//         } else {
//           throw new Error(
//             `Invalid Vendor vehicle workflow state: ${currentWorkflowState}`,
//           );
//         }
//       }

//       const isNewVendorPersonOilJettyWorkflow =
//         isVendorPersonOilJettyOnly &&
//         [
//           "PENDING_VENDOR_PERSON_CONCERN_DEPARTMENT",
//           "PENDING_VENDOR_PERSON_TRAFFIC",
//         ].includes(currentWorkflowState);

//       const isNewVendorVehicleOilJettyWorkflow =
//         !isVendorPersonOilJettyOnly &&
//         [
//           "PENDING_VENDOR_MARINE",
//           "PENDING_VENDOR_CONCERN_DEPARTMENT",
//           "PENDING_VENDOR_CISF",
//           "PENDING_VENDOR_TRAFFIC",
//         ].includes(currentWorkflowState);

//       const isNewVendorOilJettyWorkflow =
//         isNewVendorPersonOilJettyWorkflow || isNewVendorVehicleOilJettyWorkflow;

//       /*
//        * A REVERTED request is intentionally NOT accepted here.
//        * Vendor must resubmit it first.
//        */
//       if (!isNewVendorOilJettyWorkflow) {
//         throw new Error(
//           `This Vendor Oil-Jetty request is not awaiting workflow approval. Current state: ${currentWorkflowState || "UNKNOWN"}`,
//         );
//       }

//       /*
//        * ==========================================================
//        * 4. Determine which workflow stage this logged-in user
//        *    represents.
//        *
//        * Exact IDs from your database:
//        *
//        * Marine:
//        *   Department 7
//        *   Fire Safety Officer 27
//        *   Dy. Conservator 29
//        *
//        * Concern:
//        *   Engineering Civil 3 / Mechanical 4
//        *   Approval role 4
//        *
//        * CISF:
//        *   Department 1
//        *   Assistant Commandant 30
//        *
//        * Traffic:
//        *   Department 9
//        *   Approval role 4
//        * ==========================================================
//        */
//       // let currentStage = null;
//       // let expectedWorkflowState = null;
//       // let nextWorkflowState = null;

//       const isMarineApprover =
//         normalizedDepartmentId === 7 && [27, 29].includes(normalizedRoleId);

//       const isConcernApprover =
//         normalizedRoleId === 4 && [3, 4].includes(normalizedDepartmentId);

//       const isCisfApprover =
//         normalizedDepartmentId === 1 && normalizedRoleId === 30;

//       const isTrafficApprover =
//         normalizedDepartmentId === 9 && normalizedRoleId === 4;

//       if (isMarineApprover) {
//         currentStage = "MARINE";
//         expectedWorkflowState = "PENDING_VENDOR_MARINE";

//         if (selectedConcernDepartmentId === 9) {
//           // Traffic-selected vehicle:
//           // Marine -> CISF -> Traffic
//           nextWorkflowState = "PENDING_VENDOR_CISF";
//         } else if (
//           selectedConcernDepartmentId === 3 ||
//           selectedConcernDepartmentId === 4
//         ) {
//           // Civil / Mechanical:
//           // Marine -> Concern -> CISF -> Traffic
//           nextWorkflowState = "PENDING_VENDOR_CONCERN_DEPARTMENT";
//         } else {
//           throw new Error(
//             "Invalid concern department for Vendor Oil-Jetty workflow.",
//           );
//         }
//       } else if (isConcernApprover) {
//         /*
//          * IMPORTANT:
//          * The concern department must be the same department
//          * that originally created the vendor link.
//          *
//          * Example:
//          *   Civil created link -> only Civil Approval can act.
//          *   Mechanical created link -> only Mechanical Approval can act.
//          */
//         if (selectedConcernDepartmentId !== normalizedDepartmentId) {
//           throw new Error(
//             "You are not authorized to approve this Vendor Oil-Jetty request because the selected concern department is different.",
//           );
//         }

//         currentStage = "CONCERN_DEPARTMENT";
//         expectedWorkflowState = "PENDING_VENDOR_CONCERN_DEPARTMENT";
//         nextWorkflowState = "PENDING_VENDOR_CISF";
//       } else if (isCisfApprover) {
//         currentStage = "CISF";
//         expectedWorkflowState = "PENDING_VENDOR_CISF";
//         nextWorkflowState = "PENDING_VENDOR_TRAFFIC";
//       } else if (isTrafficApprover) {
//         currentStage = "TRAFFIC";
//         expectedWorkflowState = "PENDING_VENDOR_TRAFFIC";
//         nextWorkflowState = "COMPLETED";
//       } else {
//         throw new Error(
//           "You are not authorized for the Vendor Oil-Jetty workflow.",
//         );
//       }

//       /*
//        * ==========================================================
//        * 5. ATOMIC stage verification
//        *
//        * Example:
//        * Fire Safety and Dy. Conservator both have the same
//        * request open.
//        *
//        * Fire Safety approves first:
//        *   state changes from MARINE -> CONCERN_DEPARTMENT
//        *
//        * Dy. Conservator then hits this check:
//        *   current state is no longer MARINE
//        *
//        * Therefore the second action is rejected.
//        * ==========================================================
//        */
//       if (currentWorkflowState !== expectedWorkflowState) {
//         throw new Error(
//           `This request has already been processed for the ${currentStage} stage.`,
//         );
//       }

//       /*
//        * ==========================================================
//        * 6. Find the acting user's name for audit/history
//        * ==========================================================
//        */
//       const userRes = await client.query(
//         `
//           SELECT "userName"
//           FROM "users"
//           WHERE id = $1
//         `,
//         [normalizedUserId],
//       );

//       const actedByUserName =
//         userRes.rows[0]?.userName || `User ${normalizedUserId}`;

//       const targetTable =
//         normalizedEntityType === "PERSON"
//           ? "vendor_pass_persons"
//           : "vendor_pass_vehicles";

//       await client.query(
//         `
//     UPDATE "${targetTable}"
//     SET
//       "workflowState" = $2,
//       "workflowActionStage" = $3,
//       "workflowActionRemarks" = $4,
//       "updatedAt" = NOW()
//     WHERE id = $1
//   `,
//         [
//           normalizedEntityId,
//           nextWorkflowState,
//           currentStage,
//           normalizedRemarks,
//         ],
//       );

//       /*
//        * ==========================================================
//        * 7. REJECT
//        *
//        * Reject ends the complete workflow.
//        * ==========================================================
//        */
//       if (normalizedDecision === "REJECTED") {
//         await client.query(
//           `
//       UPDATE "${targetTable}"
//       SET
//         "status" = 'rejected',
//         "workflowState" = 'REJECTED',
//         "workflowActionStage" = $2,
//         "workflowActionRemarks" = $3,
//         "updatedAt" = NOW()
//       WHERE id = $1
//     `,
//           [normalizedEntityId, currentStage, normalizedRemarks],
//         );
//       }

//       /*
//        * ==========================================================
//        * 8. REVERT
//        *
//        * The whole request is returned to the vendor.
//        *
//        * We mark all currently active entities as reverted so the
//        * EXISTING vendor correction page can identify them and
//        * allow the vendor to update them.
//        * ==========================================================
//        */
//       if (normalizedDecision === "REVERTED") {
//         await client.query(
//           `
//       UPDATE "${targetTable}"
//       SET
//         "status" = 'reverted',
//         "workflowState" = 'REVERTED',
//         "workflowActionStage" = $2,
//         "workflowActionRemarks" = $3,
//         "isReverted" = true,
//         "updatedAt" = NOW()
//       WHERE id = $1
//     `,
//           [normalizedEntityId, currentStage, normalizedRemarks],
//         );
//       }

//       /*
//        * ==========================================================
//        * 9. APPROVE
//        *
//        * Intermediate stages:
//        *
//        * MARINE -> CONCERN_DEPARTMENT
//        * CONCERN_DEPARTMENT -> CISF
//        * CISF -> TRAFFIC
//        *
//        * Final:
//        *
//        * TRAFFIC -> COMPLETED
//        * ==========================================================
//        */
//       if (normalizedDecision === "APPROVED") {
//         await client.query(
//           `
//       UPDATE "${targetTable}"
//       SET
//         "status" = 'approved',
//         "workflowState" = $2,
//         "workflowActionStage" = $3,
//         "workflowActionRemarks" = $4,
//         "updatedAt" = NOW()
//       WHERE id = $1
//     `,
//           [
//             normalizedEntityId,
//             nextWorkflowState,
//             currentStage,
//             normalizedRemarks,
//           ],
//         );
//       }

//       throw new Error("Unhandled workflow decision.");
//     } catch (error) {
//       try {
//         await client.query("ROLLBACK");
//       } catch (rollbackError) {
//         console.error(
//           "Vendor Oil-Jetty workflow rollback failed:",
//           rollbackError,
//         );
//       }

//       throw error;
//     } finally {
//       client.release();
//     }
//   },
