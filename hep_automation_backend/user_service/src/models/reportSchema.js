const { pool } = require("../dbconfig/db");

const MAX_REPORT_LIMIT = 500;

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeLimit(value) {
  return Math.min(toPositiveInt(value, 100), MAX_REPORT_LIMIT);
}

const Report = {
  async getRegisteredUserOptions() {
    const result = await pool.query(`
      SELECT MIN(id) AS id, name
      FROM (
        SELECT id, TRIM(name) AS name
        FROM "User_types"
        WHERE name IS NOT NULL AND TRIM(name) <> ''

        UNION

        SELECT NULL::integer AS id, TRIM(a."userTypeName") AS name
        FROM "Agents" a
        WHERE a."userTypeName" IS NOT NULL AND TRIM(a."userTypeName") <> ''
      ) company_types
      GROUP BY name
      ORDER BY name ASC
    `);

    return result.rows;
  },

  async getRegisteredUsersReport(filters = {}) {
    const limit = normalizeLimit(filters.limit);
    const page = toPositiveInt(filters.page, 1);
    const offset = (page - 1) * limit;
    const params = [];
    const where = [];

    if (filters.companyCode) {
      params.push(`%${filters.companyCode.trim()}%`);
      where.push(`(
        a."loginId" ILIKE $${params.length}
        OR a."referenceNumber" ILIKE $${params.length}
        OR a."entityName" ILIKE $${params.length}
      )`);
    }

    if (filters.companyType) {
      params.push(filters.companyType.trim());
      where.push(`a."userTypeName" = $${params.length}`);
    }

    if (filters.find) {
      params.push(`%${filters.find.trim()}%`);
      where.push(`(
        a."loginId" ILIKE $${params.length}
        OR a."referenceNumber" ILIKE $${params.length}
        OR a."entityName" ILIKE $${params.length}
        OR a."userTypeName" ILIKE $${params.length}
        OR a."mobileNo" ILIKE $${params.length}
        OR a.email ILIKE $${params.length}
        OR a."addressLine" ILIKE $${params.length}
        OR a.city ILIKE $${params.length}
        OR a.state ILIKE $${params.length}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM "Agents" a ${whereSql}`,
      params,
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `
        SELECT
          a.id,
          a."referenceNumber",
          a."loginId" AS "companyCode",
          a."entityName" AS "companyName",
          a."userTypeName" AS "companyType",
          a."mobileNo",
          a.email,
          a."addressLine" AS address,
          a.city,
          a.state,
          a."gstinNumber",
          a."panNumber",
          a.status,
          a."isApproved",
          a."createdAt"
        FROM "Agents" a
        ${whereSql}
        ORDER BY a."createdAt" DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params,
    );

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        totalRecords: countResult.rows[0]?.total || 0,
      },
    };
  },

  async getTypeOfPassIssuedReport(filters = {}) {
    const limit = normalizeLimit(filters.limit);
    const page = toPositiveInt(filters.page, 1);
    const offset = (page - 1) * limit;
    const params = [];
    const where = [];

    if (filters.fromDate) {
      params.push(filters.fromDate);
      where.push(`entry."createdAt" >= ($${params.length}::timestamp AT TIME ZONE 'Asia/Kolkata')`);
    }

    if (filters.toDate) {
      params.push(filters.toDate);
      where.push(`entry."createdAt" <= ($${params.length}::timestamp AT TIME ZONE 'Asia/Kolkata')`);
    }

    if (filters.requestNumber) {
      params.push(`%${filters.requestNumber.trim()}%`);
      where.push(`entry."requestNumber" ILIKE $${params.length}`);
    }

    if (filters.vehicleOrPersonName) {
      params.push(`%${filters.vehicleOrPersonName.trim()}%`);
      where.push(`entry."vehicleOrPersonName" ILIKE $${params.length}`);
    }

    if (filters.transporterNameOrCode) {
      params.push(`%${filters.transporterNameOrCode.trim()}%`);
      where.push(`(
        entry."transporterName" ILIKE $${params.length}
        OR entry."transporterCode" ILIKE $${params.length}
      )`);
    }

    if (filters.passType) {
      params.push(filters.passType.trim());
      where.push(`entry."passType" = $${params.length}`);
    }

    if (filters.passRequestType) {
      params.push(filters.passRequestType.trim());
      where.push(`entry."passRequestType" = $${params.length}`);
    }

    const baseQuery = `
      WITH entry AS (
        SELECT
          pr.id AS "passRequestId",
          pr."referenceNo" AS "requestNumber",
          CASE
            WHEN pr."originType"::text = 'AGENT' THEN 'Online Transporter'
            WHEN pr."originType"::text = 'VENDOR' THEN 'Vendor Pass'
            ELSE 'On Gate pass'
          END AS "passRequestType",
          COALESCE(pp.name, mp.name) AS "vehicleOrPersonName",
          CASE
            WHEN ht.name ILIKE 'Driver%' THEN 'Driver'
            ELSE 'Person'
          END AS "passType",
          pp."passType"::text AS "passDuration",
          pp."dateFrom",
          pp."dateTo",
          pp.amount,
          pp.status::text AS status,
          pp."createdAt",
          a."entityName" AS "transporterName",
          a."loginId" AS "transporterCode"
        FROM pass_persons pp
        JOIN pass_requests pr ON pr.id = pp."passRequestId"
        LEFT JOIN "Agents" a ON a.id = pr."agentId"
        LEFT JOIN master_persons mp ON mp.id = pp."masterPersonId"
        LEFT JOIN hep_types ht ON ht.id = COALESCE(pp."hepTypeId", mp."hepTypeId")

        UNION ALL

        SELECT
          pr.id AS "passRequestId",
          pr."referenceNo" AS "requestNumber",
          CASE
            WHEN pr."originType"::text = 'AGENT' THEN 'Online Transporter'
            WHEN pr."originType"::text = 'VENDOR' THEN 'Vendor Pass'
            ELSE 'On Gate pass'
          END AS "passRequestType",
          COALESCE(pv."registrationNo", mv."registrationNo") AS "vehicleOrPersonName",
          'Vehicle' AS "passType",
          pv."passType"::text AS "passDuration",
          pv."dateFrom",
          pv."dateTo",
          pv.amount,
          pv.status::text AS status,
          pv."createdAt",
          a."entityName" AS "transporterName",
          a."loginId" AS "transporterCode"
        FROM pass_vehicles pv
        JOIN pass_requests pr ON pr.id = pv."passRequestId"
        LEFT JOIN "Agents" a ON a.id = pr."agentId"
        LEFT JOIN master_vehicles mv ON mv.id = pv."masterVehicleId"

        UNION ALL

        SELECT
          vpr.id AS "passRequestId",
          vpr."referenceNo" AS "requestNumber",
          'Vendor Pass' AS "passRequestType",
          vpp.name AS "vehicleOrPersonName",
          CASE
            WHEN ht.name ILIKE 'Driver%' THEN 'Driver'
            ELSE 'Person'
          END AS "passType",
          vpp."passType"::text AS "passDuration",
          vpp."dateFrom",
          vpp."dateTo",
          vpp.amount,
          vpp.status::text AS status,
          vpp."createdAt",
          vpr."companyName" AS "transporterName",
          vpr."referenceNo" AS "transporterCode"
        FROM vendor_pass_persons vpp
        JOIN vendor_pass_requests vpr ON vpr.id = vpp."vendorPassRequestId"
        LEFT JOIN hep_types ht ON ht.id = vpp."hepTypeId"

        UNION ALL

        SELECT
          vpr.id AS "passRequestId",
          vpr."referenceNo" AS "requestNumber",
          'Vendor Pass' AS "passRequestType",
          vpv."vehicleRegistrationNo" AS "vehicleOrPersonName",
          'Vehicle' AS "passType",
          vpv."passType"::text AS "passDuration",
          vpv."dateFrom",
          vpv."dateTo",
          vpv.amount,
          vpv.status::text AS status,
          vpv."createdAt",
          vpr."companyName" AS "transporterName",
          vpr."referenceNo" AS "transporterCode"
        FROM vendor_pass_vehicles vpv
        JOIN vendor_pass_requests vpr ON vpr.id = vpv."vendorPassRequestId"
      )
    `;

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countResult = await pool.query(
      `${baseQuery} SELECT COUNT(*)::int AS total FROM entry ${whereSql}`,
      params,
    );

    const summaryResult = await pool.query(
      `
        ${baseQuery}
        SELECT
          COALESCE("passType", 'UNKNOWN') AS "passType",
          "passRequestType",
          COUNT(*)::int AS count,
          COALESCE(SUM(amount), 0)::numeric AS amount
        FROM entry
        ${whereSql}
        GROUP BY "passType", "passRequestType"
        ORDER BY "passType", "passRequestType"
      `,
      params,
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `
        ${baseQuery}
        SELECT *
        FROM entry
        ${whereSql}
        ORDER BY "createdAt" DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params,
    );

    return {
      data: dataResult.rows,
      summary: summaryResult.rows,
      pagination: {
        page,
        limit,
        totalRecords: countResult.rows[0]?.total || 0,
      },
    };
  },

  async getAllPassIssuanceOptions() {
    const result = await pool.query(`
      SELECT
        ARRAY(
          SELECT DISTINCT value FROM (
            SELECT "userTypeName" AS value FROM "Agents"
            UNION ALL SELECT 'Vendor'
          ) option_values WHERE value IS NOT NULL ORDER BY 1
        ) AS "companyTypes",
        ARRAY(
          SELECT DISTINCT value FROM (
            SELECT "passType"::text AS value FROM pass_persons
            UNION ALL SELECT "passType"::text FROM pass_vehicles
            UNION ALL SELECT "passType"::text FROM vendor_pass_persons
            UNION ALL SELECT "passType"::text FROM vendor_pass_vehicles
          ) option_values WHERE value IS NOT NULL ORDER BY 1
        ) AS "passTypes",
        ARRAY(
          SELECT DISTINCT value FROM (
            SELECT status::text AS value FROM pass_requests
            UNION ALL SELECT status::text FROM vendor_pass_requests
          ) option_values WHERE value IS NOT NULL ORDER BY 1
        ) AS "approvalStatuses",
        ARRAY['Person','Vehicle']::text[] AS "passHolderTypes",
        ARRAY(
          SELECT DISTINCT value FROM (
            SELECT nationality::text AS value FROM pass_persons
            UNION ALL SELECT nationality::text FROM vendor_pass_persons
          ) option_values WHERE value IS NOT NULL ORDER BY 1
        ) AS nationalities,
        ARRAY(
          SELECT DISTINCT "departmentName"
          FROM (
            SELECT "departmentName" FROM bulk_pass_batches
            UNION ALL
            SELECT "departmentName" FROM vendor_pass_requests
          ) department_sources
          WHERE "departmentName" IS NOT NULL AND TRIM("departmentName") <> ''
          ORDER BY 1
        ) AS departments,
        ARRAY(
          SELECT DISTINCT value FROM (
            SELECT "paymentMode"::text AS value FROM pass_requests
            UNION ALL SELECT "paymentMode"::text FROM vendor_pass_requests
          ) option_values WHERE value IS NOT NULL ORDER BY 1
        ) AS "paymentTypes",
        ARRAY['Person','Vehicle']::text[] AS "cardTypes",
        ARRAY['Person','Vehicle']::text[] AS "issuedCardTypes",
        ARRAY['Online Transporter','Vendor Pass']::text[] AS "passRequestTypes",
        ARRAY[]::text[] AS "transactionTypes",
        ARRAY[]::text[] AS "paymentStatuses"
    `);
    return result.rows[0];
  },

  async getAllPassIssuanceReport(filters = {}) {
    const limit = normalizeLimit(filters.limit);
    const page = toPositiveInt(filters.page, 1);
    const offset = (page - 1) * limit;
    const params = [];
    const where = [];
    const addLike = (column, value) => {
      if (!value) return;
      params.push(`%${String(value).trim()}%`);
      where.push(`${column} ILIKE $${params.length}`);
    };
    if (filters.fromDate) {
      params.push(filters.fromDate);
      where.push(`entry."createdAt" >= ($${params.length}::timestamp AT TIME ZONE 'Asia/Kolkata')`);
    }
    if (filters.toDate) {
      params.push(filters.toDate);
      where.push(`entry."createdAt" <= ($${params.length}::timestamp AT TIME ZONE 'Asia/Kolkata')`);
    }
    addLike(`entry."passId"`, filters.passId);
    addLike(`entry."requestNumber"`, filters.requestNumber);
    addLike(`entry."cardHolder"`, filters.cardHolder);
    addLike(`entry."companySearch"`, filters.companyCodeOrName);
    addLike(`entry."idProof"`, filters.idProof);
    addLike(`entry.aadhaar`, filters.aadhaar);
    if (filters.companyType) { params.push(filters.companyType); where.push(`entry."companyType" = $${params.length}`); }
    if (filters.passType) { params.push(filters.passType); where.push(`entry."passType" = $${params.length}`); }
    if (filters.approvalStatus) { params.push(filters.approvalStatus); where.push(`entry."approvalStatus" = $${params.length}`); }
    if (filters.passHolderType) { params.push(filters.passHolderType); where.push(`entry."passHolderType" = $${params.length}`); }
    if (filters.nationality) { params.push(filters.nationality); where.push(`entry.nationality = $${params.length}`); }
    if (filters.department) { params.push(filters.department); where.push(`entry.department = $${params.length}`); }
    if (filters.paymentType) { params.push(filters.paymentType); where.push(`entry."paymentType" = $${params.length}`); }
    const baseQuery = `WITH entry AS (
      SELECT 'Regular'::text AS source, pp."personPassNo" AS "passId", pr."referenceNo" AS "requestNumber", pp.name AS "cardHolder",
        'Person'::text AS "passHolderType", a."entityName" AS "companyName", a."loginId" AS "companyCode",
        CONCAT_WS(' ', a."entityName", a."loginId") AS "companySearch", a."userTypeName" AS "companyType", NULL::text AS department,
        pp."passType"::text AS "passType", pr.status::text AS "approvalStatus", pr."paymentMode"::text AS "paymentType",
        pp."dateFrom", pp."dateTo", pp.amount, pp."createdAt", pp."idProofNumber" AS "idProof",
        pp."aadharNo" AS aadhaar, pp.nationality::text AS nationality, pp."qrUuid"::text AS "qrReference",
        pp."qrIssuedAt", COALESCE(pp."qrRevoked", false) AS "qrRevoked", COALESCE(pp."scanCount", 0) AS "scanCount", pp."lastScannedAt"
      FROM pass_persons pp JOIN pass_requests pr ON pr.id=pp."passRequestId" LEFT JOIN "Agents" a ON a.id=pr."agentId"
      UNION ALL
      SELECT 'Regular', pv."vehiclePassNo", pr."referenceNo", pv."registrationNo", 'Vehicle', a."entityName", a."loginId",
        CONCAT_WS(' ', a."entityName", a."loginId"), a."userTypeName", NULL::text, pv."passType"::text, pr.status::text,
        pr."paymentMode"::text, pv."dateFrom", pv."dateTo", pv.amount, pv."createdAt", NULL, NULL, NULL,
        pv."qrUuid"::text, pv."qrIssuedAt", COALESCE(pv."qrRevoked", false), COALESCE(pv."scanCount",0), pv."lastScannedAt"
      FROM pass_vehicles pv JOIN pass_requests pr ON pr.id=pv."passRequestId" LEFT JOIN "Agents" a ON a.id=pr."agentId"
      UNION ALL
      SELECT 'Vendor', vpp."personPassNo", vpr."referenceNo", vpp.name, 'Person', vpr."companyName", vpr."referenceNo",
        CONCAT_WS(' ',vpr."companyName",vpr."referenceNo"), 'Vendor', vpr."departmentName", vpp."passType", vpr.status::text,
        vpr."paymentMode"::text, vpp."dateFrom", vpp."dateTo", vpp.amount, vpp."createdAt", vpp."idProofNumber",
        vpp."aadharNo", vpp.nationality::text, NULL, NULL, false, 0, NULL
      FROM vendor_pass_persons vpp JOIN vendor_pass_requests vpr ON vpr.id=vpp."vendorPassRequestId"
      UNION ALL
      SELECT 'Vendor', vpv."vehiclePassNo", vpr."referenceNo", vpv."vehicleRegistrationNo", 'Vehicle', vpr."companyName", vpr."referenceNo",
        CONCAT_WS(' ',vpr."companyName",vpr."referenceNo"), 'Vendor', vpr."departmentName", vpv."passType", vpr.status::text,
        vpr."paymentMode"::text, vpv."dateFrom", vpv."dateTo", vpv.amount, vpv."createdAt", NULL, NULL, NULL,
        NULL, NULL, false, 0, NULL
      FROM vendor_pass_vehicles vpv JOIN vendor_pass_requests vpr ON vpr.id=vpv."vendorPassRequestId"
    )`;
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countResult = await pool.query(`${baseQuery} SELECT COUNT(*)::int AS total FROM entry ${whereSql}`, params);
    params.push(limit, offset);
    const dataResult = await pool.query(`${baseQuery} SELECT * FROM entry ${whereSql} ORDER BY "createdAt" DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { data: dataResult.rows, pagination: { page, limit, totalRecords: countResult.rows[0]?.total || 0 } };
  },

  async getRevenueReport(filters = {}) {
    const report = await this.getAllPassIssuanceReport(filters);
    report.data = report.data.map((row) => ({
      passId: row.passId, companyCode: row.companyCode, companyName: row.companyName,
      holder: row.cardHolder, holderType: row.passHolderType, passType: row.passType,
      paymentType: row.paymentType, approvalStatus: row.approvalStatus,
      amount: row.amount, issuedAt: row.createdAt,
    }));
    return report;
  },

  async getPassApprovalReport(filters = {}) {
    return this.getAllPassIssuanceReport({
      ...filters,
      cardHolder: filters.vehicleOrPersonName,
      companyCodeOrName: filters.transporterNameOrCode,
      requestNumber: filters.requestNumber,
      approvalStatus: filters.approvalStatus,
    });
  },

  async getQrInventorySummary(filters = {}) {
    const params = [];
    let companyFilter = "";
    if (filters.companyCode) {
      params.push(`%${filters.companyCode.trim()}%`);
      companyFilter = `AND (a."loginId" ILIKE $1 OR a."entityName" ILIKE $1)`;
    }
    const result = await pool.query(`
      SELECT "holderType", "qrStatus", COUNT(*)::int AS count
      FROM (
        SELECT 'Person' AS "holderType", CASE WHEN pp."qrRevoked" THEN 'Revoked' WHEN pp."qrIssuedAt" IS NOT NULL THEN 'Issued' ELSE 'Pending' END AS "qrStatus"
        FROM pass_persons pp JOIN pass_requests pr ON pr.id=pp."passRequestId" LEFT JOIN "Agents" a ON a.id=pr."agentId" WHERE TRUE ${companyFilter}
        UNION ALL
        SELECT 'Vehicle', CASE WHEN pv."qrRevoked" THEN 'Revoked' WHEN pv."qrIssuedAt" IS NOT NULL THEN 'Issued' ELSE 'Pending' END
        FROM pass_vehicles pv JOIN pass_requests pr ON pr.id=pv."passRequestId" LEFT JOIN "Agents" a ON a.id=pr."agentId" WHERE TRUE ${companyFilter}
      ) q GROUP BY "holderType", "qrStatus" ORDER BY "holderType", "qrStatus"
    `, params);
    return { data: result.rows, pagination: { page: 1, limit: 500, totalRecords: result.rowCount } };
  },

  async getGateSummary(filters = {}, laneWise = false) {
    const params = [];
    let dateFilterPerson = "";
    let dateFilterVehicle = "";
    if (filters.fromDate) {
      params.push(filters.fromDate);
      dateFilterPerson = `AND pp."lastScannedAt" >= ($1::timestamp AT TIME ZONE 'Asia/Kolkata')`;
      dateFilterVehicle = `AND pv."lastScannedAt" >= ($1::timestamp AT TIME ZONE 'Asia/Kolkata')`;
    }
    const dimension = laneWise ? "lane" : "gate";
    const result = await pool.query(`
      SELECT 'Not Recorded'::text AS "${dimension}", "holderType", SUM("scanCount")::int AS "scanCount",
        COUNT(*) FILTER (WHERE "lastScannedAt" IS NOT NULL)::int AS "scannedPasses", MAX("lastScannedAt") AS "lastScan"
      FROM (
        SELECT 'Person'::text AS "holderType", COALESCE(pp."scanCount",0) AS "scanCount", pp."lastScannedAt" FROM pass_persons pp WHERE TRUE ${dateFilterPerson}
        UNION ALL
        SELECT 'Vehicle', COALESCE(pv."scanCount",0), pv."lastScannedAt" FROM pass_vehicles pv WHERE TRUE ${dateFilterVehicle}
      ) scans GROUP BY "holderType" ORDER BY "holderType"
    `, params);
    return { data: result.rows, limitation: "Gate and lane identifiers are not stored yet; scan totals use available QR scan data.", pagination: { page: 1, limit: 500, totalRecords: result.rowCount } };
  },

  async getPassPenaltyReport(filters = {}) {
    const params = [];
    const where = [];
    if (filters.cardNo) { params.push(`%${filters.cardNo.trim()}%`); where.push(`p.identifier ILIKE $${params.length}`); }
    if (filters.companyCode) {
      params.push(`%${filters.companyCode.trim()}%`);
      where.push(`(p."companyCode" ILIKE $${params.length} OR p."companyName" ILIKE $${params.length})`);
    }
    if (filters.fromDate) {
      params.push(filters.fromDate);
      where.push(`p."createdAt" >= ($${params.length}::timestamp AT TIME ZONE 'Asia/Kolkata')`);
    }
    if (filters.toDate) {
      params.push(`${filters.toDate} 23:59:59`);
      where.push(`p."createdAt" <= ($${params.length}::timestamp AT TIME ZONE 'Asia/Kolkata')`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await pool.query(`
      WITH pass_company AS (
        SELECT pp."personPassNo" AS identifier, a."loginId" AS "companyCode", a."entityName" AS "companyName"
        FROM pass_persons pp JOIN pass_requests pr ON pr.id=pp."passRequestId" LEFT JOIN "Agents" a ON a.id=pr."agentId"
        WHERE pp."personPassNo" IS NOT NULL
        UNION ALL
        SELECT pv."registrationNo", a."loginId", a."entityName"
        FROM pass_vehicles pv JOIN pass_requests pr ON pr.id=pv."passRequestId" LEFT JOIN "Agents" a ON a.id=pr."agentId"
        WHERE pv."registrationNo" IS NOT NULL
        UNION ALL
        SELECT pv."vehiclePassNo", a."loginId", a."entityName"
        FROM pass_vehicles pv JOIN pass_requests pr ON pr.id=pv."passRequestId" LEFT JOIN "Agents" a ON a.id=pr."agentId"
        WHERE pv."vehiclePassNo" IS NOT NULL
      ), p AS (
        SELECT 'Blacklist' AS source, b.identifier, b.entity_name AS "entityName", b.entity_type AS "entityType", b.reason,
          b.penalty_amount AS amount, b.penalty_status AS status, b.payment_method AS "paymentMethod", b.transaction_id AS "transactionId",
          pc."companyCode", pc."companyName", b."createdAt"
        FROM blacklist_entries b LEFT JOIN pass_company pc ON pc.identifier=b.identifier WHERE b.has_penalty = true
        UNION ALL
        SELECT 'Overstay', o.identifier, o.entity_name, o.entity_type, COALESCE(o.notes,'Overstay charge'), o.total_amount,
          o.status, o.payment_method, o.transaction_id, pc."companyCode", pc."companyName", o.created_at
        FROM overstay_charges o LEFT JOIN pass_company pc ON pc.identifier=o.identifier
      ) SELECT * FROM p ${whereSql} ORDER BY "createdAt" DESC LIMIT 500
    `, params);
    return { data: result.rows, pagination: { page: 1, limit: 500, totalRecords: result.rowCount } };
  },

};

module.exports = Report;
