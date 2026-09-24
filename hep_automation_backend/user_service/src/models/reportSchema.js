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
          a."createdAt",
          TO_CHAR(a."createdAt" AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY') AS date,
          TO_CHAR(a."createdAt" AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS time
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

    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      where.push(`(
        entry."requestNumber" ILIKE $${params.length}
        OR entry."passRequestType" ILIKE $${params.length}
        OR entry."vehicleOrPersonName" ILIKE $${params.length}
        OR entry."passType" ILIKE $${params.length}
        OR entry."passDuration" ILIKE $${params.length}
        OR entry.status ILIKE $${params.length}
        OR entry."transporterName" ILIKE $${params.length}
        OR entry."transporterCode" ILIKE $${params.length}
      )`);
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
        SELECT entry.*,
          TO_CHAR(entry."createdAt" AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY') AS date,
          TO_CHAR(entry."createdAt" AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS time
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
    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      where.push(`(
        entry.source ILIKE $${params.length}
        OR entry."passId" ILIKE $${params.length}
        OR entry."requestNumber" ILIKE $${params.length}
        OR entry."cardHolder" ILIKE $${params.length}
        OR entry."passHolderType" ILIKE $${params.length}
        OR entry."companySearch" ILIKE $${params.length}
        OR entry."companyType" ILIKE $${params.length}
        OR entry.department ILIKE $${params.length}
        OR entry."passType" ILIKE $${params.length}
        OR entry."approvalStatus" ILIKE $${params.length}
        OR entry."paymentType" ILIKE $${params.length}
        OR entry."idProof" ILIKE $${params.length}
        OR entry.aadhaar ILIKE $${params.length}
        OR entry.nationality ILIKE $${params.length}
      )`);
    }
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
    const dataResult = await pool.query(`${baseQuery} SELECT entry.*,
      TO_CHAR(entry."createdAt" AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY') AS date,
      TO_CHAR(entry."createdAt" AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS time
      FROM entry ${whereSql} ORDER BY "createdAt" DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { data: dataResult.rows, pagination: { page, limit, totalRecords: countResult.rows[0]?.total || 0 } };
  },

  async getRevenueReport(filters = {}) {
    const report = await this.getAllPassIssuanceReport(filters);
    report.data = report.data.map((row) => ({
      passId: row.passId, companyCode: row.companyCode, companyName: row.companyName,
      holder: row.cardHolder, holderType: row.passHolderType, passType: row.passType,
      paymentType: row.paymentType, approvalStatus: row.approvalStatus,
      amount: row.amount, issuedAt: row.createdAt, date: row.date, time: row.time,
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
      const companyCode = filters.companyCode.trim();
      params.push(`%${companyCode}%`, `%${companyCode.replace(/[^a-z0-9]/gi, "")}%`);
      companyFilter = `AND (
        a."loginId" ILIKE $1
        OR a."entityName" ILIKE $1
        OR REGEXP_REPLACE(a."loginId", '[^a-zA-Z0-9]', '', 'g') ILIKE $2
      )`;
    }
    let searchFilter = "";
    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      searchFilter = `WHERE (
        q."holderType" ILIKE $${params.length}
        OR q."qrStatus" ILIKE $${params.length}
      )`;
    }
    const result = await pool.query(`
      SELECT "holderType", "qrStatus", COUNT(*)::int AS count,
        TO_CHAR(MAX("eventTime") AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY') AS date,
        TO_CHAR(MAX("eventTime") AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS time
      FROM (
        SELECT 'Person' AS "holderType", CASE WHEN pp."qrRevoked" THEN 'Revoked' WHEN pp."qrIssuedAt" IS NOT NULL THEN 'Issued' ELSE 'Pending' END AS "qrStatus", COALESCE(pp."qrIssuedAt", pp."updatedAt", pp."createdAt") AS "eventTime"
        FROM pass_persons pp JOIN pass_requests pr ON pr.id=pp."passRequestId" LEFT JOIN "Agents" a ON a.id=pr."agentId" WHERE TRUE ${companyFilter}
        UNION ALL
        SELECT 'Vehicle', CASE WHEN pv."qrRevoked" THEN 'Revoked' WHEN pv."qrIssuedAt" IS NOT NULL THEN 'Issued' ELSE 'Pending' END, COALESCE(pv."qrIssuedAt", pv."updatedAt", pv."createdAt")
        FROM pass_vehicles pv JOIN pass_requests pr ON pr.id=pv."passRequestId" LEFT JOIN "Agents" a ON a.id=pr."agentId" WHERE TRUE ${companyFilter}
      ) q ${searchFilter} GROUP BY "holderType", "qrStatus" ORDER BY "holderType", "qrStatus"
    `, params);
    return { data: result.rows, pagination: { page: 1, limit: 500, totalRecords: result.rowCount } };
  },

  async getGateSummary(filters = {}, laneWise = false) {
    const params = [];
    let dateFilterPerson = "";
    let dateFilterVehicle = "";
    if (filters.fromDate) {
      params.push(filters.fromDate);
      dateFilterPerson = `AND pp."lastScannedAt" >= ($${params.length}::timestamp AT TIME ZONE 'Asia/Kolkata')`;
      dateFilterVehicle = `AND pv."lastScannedAt" >= ($${params.length}::timestamp AT TIME ZONE 'Asia/Kolkata')`;
    }
    let searchFilter = "";
    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      searchFilter = `WHERE (
        scans."holderType" ILIKE $${params.length}
        OR 'Not Recorded' ILIKE $${params.length}
      )`;
    }
    const dimension = laneWise ? "lane" : "gate";
    const result = await pool.query(`
      SELECT 'Not Recorded'::text AS "${dimension}", "holderType", SUM("scanCount")::int AS "scanCount",
        COUNT(*) FILTER (WHERE "lastScannedAt" IS NOT NULL)::int AS "scannedPasses", MAX("lastScannedAt") AS "lastScan",
        TO_CHAR(MAX("lastScannedAt") AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY') AS date,
        TO_CHAR(MAX("lastScannedAt") AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS time
      FROM (
        SELECT 'Person'::text AS "holderType", COALESCE(pp."scanCount",0) AS "scanCount", pp."lastScannedAt" FROM pass_persons pp WHERE TRUE ${dateFilterPerson}
        UNION ALL
        SELECT 'Vehicle', COALESCE(pv."scanCount",0), pv."lastScannedAt" FROM pass_vehicles pv WHERE TRUE ${dateFilterVehicle}
      ) scans ${searchFilter} GROUP BY "holderType" ORDER BY "holderType"
    `, params);
    return { data: result.rows, limitation: "Gate and lane identifiers are not stored yet; scan totals use available QR scan data.", pagination: { page: 1, limit: 500, totalRecords: result.rowCount } };
  },

  async getPassPenaltyReport(filters = {}) {
    const limit = normalizeLimit(filters.limit);
    const page = toPositiveInt(filters.page, 1);
    const offset = (page - 1) * limit;
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
    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      where.push(`(
        p.source ILIKE $${params.length}
        OR p.identifier ILIKE $${params.length}
        OR p."entityName" ILIKE $${params.length}
        OR p."entityType" ILIKE $${params.length}
        OR p.reason ILIKE $${params.length}
        OR p.status ILIKE $${params.length}
        OR p."paymentMethod" ILIKE $${params.length}
        OR p."transactionId" ILIKE $${params.length}
        OR p."companyCode" ILIKE $${params.length}
        OR p."companyName" ILIKE $${params.length}
      )`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const baseQuery = `
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
      )
    `;
    const countResult = await pool.query(
      `${baseQuery} SELECT COUNT(*)::int AS total FROM p ${whereSql}`,
      params,
    );
    params.push(limit, offset);
    const result = await pool.query(`${baseQuery}
        SELECT p.*,
          TO_CHAR(p."createdAt" AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY') AS date,
          TO_CHAR(p."createdAt" AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS time
        FROM p ${whereSql}
        ORDER BY "createdAt" DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    return {
      data: result.rows,
      pagination: {
        page,
        limit,
        totalRecords: countResult.rows[0]?.total || 0,
      },
    };
  },

  async getShiftWiseApprovalReport(filters = {}) {
    const limit = normalizeLimit(filters.limit);
    const page = toPositiveInt(filters.page, 1);
    const offset = (page - 1) * limit;
    const params = [];
    const where = [`d.decision IN ('APPROVED', 'REJECTED')`];

    if (filters.fromDate) {
      params.push(filters.fromDate);
      where.push(`d."decisionDate" >= $${params.length}::date`);
    }
    if (filters.toDate) {
      params.push(filters.toDate);
      where.push(`d."decisionDate" <= $${params.length}::date`);
    }
    if (filters.employeeName) {
      params.push(`%${filters.employeeName.trim()}%`);
      where.push(`d."employeeName" ILIKE $${params.length}`);
    }
    if (filters.employeeId) {
      params.push(`%${filters.employeeId.trim()}%`);
      where.push(`d."employeeId" ILIKE $${params.length}`);
    }
    if (filters.shift) {
      params.push(`${filters.shift.trim()}%`);
      where.push(`d.shift ILIKE $${params.length}`);
    }
    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      where.push(`(
        d."employeeName" ILIKE $${params.length}
        OR COALESCE(d."employeeId", '') ILIKE $${params.length}
        OR d.decision ILIKE $${params.length}
        OR d.shift ILIKE $${params.length}
      )`);
    }

    const decisionsSql = `
      WITH raw_decisions AS (
        SELECT
          h."actorUserId",
          NULL::text AS "actorUserName",
          CASE
            WHEN UPPER(h.action) IN ('APPROVE', 'APPROVED') THEN 'APPROVED'
            WHEN UPPER(h.action) IN ('REJECT', 'REJECTED') THEN 'REJECTED'
          END AS decision,
          h."createdAt" AS "decisionTimestamp"
        FROM pass_person_workflow_history h
        WHERE UPPER(h.action) IN ('APPROVE', 'APPROVED', 'REJECT', 'REJECTED')

        UNION ALL

        SELECT
          h."actorUserId",
          NULL::text,
          CASE
            WHEN UPPER(h.action) IN ('APPROVE', 'APPROVED') THEN 'APPROVED'
            WHEN UPPER(h.action) IN ('REJECT', 'REJECTED') THEN 'REJECTED'
          END,
          h."createdAt"
        FROM pass_vehicle_workflow_history h
        WHERE UPPER(h.action) IN ('APPROVE', 'APPROVED', 'REJECT', 'REJECTED')

        UNION ALL

        SELECT
          h."actedByUserId",
          h."actedByUserName",
          CASE
            WHEN UPPER(h.action) IN ('APPROVE', 'APPROVED') THEN 'APPROVED'
            WHEN UPPER(h.action) IN ('REJECT', 'REJECTED') THEN 'REJECTED'
          END,
          h."createdAt"
        FROM vendor_oil_jetty_workflow_history h
        WHERE UPPER(h.action) IN ('APPROVE', 'APPROVED', 'REJECT', 'REJECTED')


        UNION ALL

        SELECT
          actor.id,
          pr."approvedBy",
          CASE
            WHEN UPPER(COALESCE(pr."workflowState", '')) = 'REJECTED'
              OR UPPER(pr.status::text) = 'REJECTED' THEN 'REJECTED'
            WHEN UPPER(COALESCE(pr."workflowState", '')) = 'APPROVED'
              OR UPPER(pr.status::text) IN ('APPROVED', 'COMPLETED') THEN 'APPROVED'
          END,
          pr."updatedAt"
        FROM pass_requests pr
        LEFT JOIN LATERAL (
          SELECT u.id FROM users u
          WHERE LOWER(TRIM(u."userName")) = LOWER(TRIM(pr."approvedBy"))
          ORDER BY u.id LIMIT 1
        ) actor ON TRUE
        WHERE pr."approvedBy" IS NOT NULL
          AND (UPPER(COALESCE(pr."workflowState", '')) IN ('APPROVED', 'REJECTED')
            OR UPPER(pr.status::text) IN ('APPROVED', 'REJECTED', 'COMPLETED'))
          AND NOT EXISTS (
            SELECT 1 FROM pass_person_workflow_history ph
            WHERE ph."passRequestId" = pr.id
              AND UPPER(ph.action) IN ('APPROVE', 'APPROVED', 'REJECT', 'REJECTED')
          )
          AND NOT EXISTS (
            SELECT 1 FROM pass_vehicle_workflow_history vh
            WHERE vh."passRequestId" = pr.id
              AND UPPER(vh.action) IN ('APPROVE', 'APPROVED', 'REJECT', 'REJECTED')
          )

        UNION ALL

        SELECT
          actor.id,
          vpr."approvedBy",
          CASE
            WHEN UPPER(COALESCE(vpr."workflowState", '')) = 'REJECTED'
              OR UPPER(vpr.status::text) = 'REJECTED' THEN 'REJECTED'
            WHEN UPPER(COALESCE(vpr."workflowState", '')) = 'APPROVED'
              OR UPPER(vpr.status::text) IN ('APPROVED', 'COMPLETED') THEN 'APPROVED'
          END,
          vpr."updatedAt"
        FROM vendor_pass_requests vpr
        LEFT JOIN LATERAL (
          SELECT u.id FROM users u
          WHERE LOWER(TRIM(u."userName")) = LOWER(TRIM(vpr."approvedBy"))
          ORDER BY u.id LIMIT 1
        ) actor ON TRUE
        WHERE vpr."approvedBy" IS NOT NULL
          AND (UPPER(COALESCE(vpr."workflowState", '')) IN ('APPROVED', 'REJECTED')
            OR UPPER(vpr.status::text) IN ('APPROVED', 'REJECTED', 'COMPLETED'))
          AND NOT EXISTS (
            SELECT 1 FROM vendor_oil_jetty_workflow_history vh
            WHERE vh."vendorPassRequestId" = vpr.id
              AND UPPER(vh.action) IN ('APPROVE', 'APPROVED', 'REJECT', 'REJECTED')
          )
      ), decisions AS (
        SELECT
          COALESCE(u."userName", r."actorUserName", 'Unknown') AS "employeeName",
          u."employeeId",
          r.decision,
          r."decisionTimestamp",
          (r."decisionTimestamp" AT TIME ZONE 'Asia/Kolkata')::date AS "decisionDate",
          CASE
            WHEN (r."decisionTimestamp" AT TIME ZONE 'Asia/Kolkata')::time >= TIME '07:00'
             AND (r."decisionTimestamp" AT TIME ZONE 'Asia/Kolkata')::time < TIME '14:00'
              THEN 'Shift 1 (07:00-14:00)'
            WHEN (r."decisionTimestamp" AT TIME ZONE 'Asia/Kolkata')::time >= TIME '14:00'
             AND (r."decisionTimestamp" AT TIME ZONE 'Asia/Kolkata')::time < TIME '21:00'
              THEN 'Shift 2 (14:00-21:00)'
            ELSE 'Shift 3 (21:00-07:00)'
          END AS shift
        FROM raw_decisions r
        LEFT JOIN users u ON u.id = r."actorUserId"
      )
    `;
    const fromSql = `
      FROM decisions d
      WHERE ${where.join(" AND ")}
    `;

    const countResult = await pool.query(
      `${decisionsSql}
       SELECT COUNT(*)::int AS total
       FROM (
         SELECT d."employeeName", d."employeeId", d."decisionDate", d.shift
         ${fromSql}
         GROUP BY d."employeeName", d."employeeId", d."decisionDate", d.shift
       ) grouped_decisions`,
      params,
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `${decisionsSql}
       SELECT
         d."employeeName",
         d."employeeId",
         COUNT(*) FILTER (WHERE d.decision = 'APPROVED')::int AS "passApproved",
         COUNT(*) FILTER (WHERE d.decision = 'REJECTED')::int AS "passRejected",
         TO_CHAR(d."decisionDate", 'DD/MM/YYYY') AS date,
         TO_CHAR(
           (MAX(d."decisionTimestamp") FILTER (WHERE d.decision = 'APPROVED')) AT TIME ZONE 'Asia/Kolkata',
           'HH24:MI:SS'
         ) AS "latestApprovalTime",
         TO_CHAR(
           (MAX(d."decisionTimestamp") FILTER (WHERE d.decision = 'REJECTED')) AT TIME ZONE 'Asia/Kolkata',
           'HH24:MI:SS'
         ) AS "latestRejectionTime",
         d.shift
       ${fromSql}
       GROUP BY d."employeeName", d."employeeId", d."decisionDate", d.shift
       ORDER BY d."decisionDate" DESC, d."employeeName", d.shift
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
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

  async getBulkPassReport(filters = {}) {
    const limit = normalizeLimit(filters.limit);
    const page = toPositiveInt(filters.page, 1);
    const offset = (page - 1) * limit;
    const params = [];
    const where = [];
    const eventTime = `COALESCE(bp."approvedAt", b."updatedAt", b."createdAt")`;
    if (filters.fromDate) { params.push(filters.fromDate); where.push(`${eventTime} >= $${params.length}::date`); }
    if (filters.toDate) { params.push(filters.toDate); where.push(`${eventTime} < ($${params.length}::date + INTERVAL '1 day')`); }
    if (filters.holderType) { params.push(filters.holderType); where.push(`CASE WHEN NULLIF(bp."driverLicenseNumber", '') IS NOT NULL THEN 'Driver' WHEN NULLIF(bp."vehicleNumber", '') IS NOT NULL THEN 'Vehicle' ELSE 'Person' END = $${params.length}`); }
    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      where.push(`CONCAT_WS(' ', b."refNo", b."companyName", bp.name, bp."vehicleNumber", bp."driverLicenseNumber", bp."approvalStatus", b.status::text) ILIKE $${params.length}`);
    }
    const fromSql = `FROM bulk_pass_batches b LEFT JOIN bulk_pass_persons bp ON bp."batchId" = b.id`;
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await pool.query(`SELECT COUNT(*)::int AS total ${fromSql} ${whereSql}`, params);
    params.push(limit, offset);
    const rows = await pool.query(`
      SELECT b."refNo" AS "requestNumber", b."companyName",
        CASE WHEN NULLIF(bp."driverLicenseNumber", '') IS NOT NULL THEN 'Driver' WHEN NULLIF(bp."vehicleNumber", '') IS NOT NULL THEN 'Vehicle' ELSE 'Person' END AS "holderType",
        COALESCE(bp.name, bp."vehicleNumber", '—') AS "holderName",
        bp."vehicleNumber", bp."driverLicenseNumber",
        COALESCE(bp."approvalStatus", b.status::text) AS status,
        TO_CHAR(${eventTime} AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY') AS date,
        TO_CHAR(${eventTime} AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS time
      ${fromSql} ${whereSql}
      ORDER BY ${eventTime} DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { data: rows.rows, pagination: { page, limit, totalRecords: total.rows[0]?.total || 0 } };
  },

  async getBlacklistingReport(filters = {}) {
    const limit = normalizeLimit(filters.limit);
    const page = toPositiveInt(filters.page, 1);
    const offset = (page - 1) * limit;
    const params = [];
    const where = [];
    if (filters.fromDate) { params.push(filters.fromDate); where.push(`b.blacklisted_at >= $${params.length}::date`); }
    if (filters.toDate) { params.push(filters.toDate); where.push(`b.blacklisted_at < ($${params.length}::date + INTERVAL '1 day')`); }
    if (filters.entityType) { params.push(filters.entityType); where.push(`UPPER(b.entity_type) = UPPER($${params.length})`); }
    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      where.push(`CONCAT_WS(' ', b.entity_type, b.identifier, b.entity_name, b.reason, b.status) ILIKE $${params.length}`);
    }
    const fromSql = `FROM blacklist_entries b LEFT JOIN users u ON u.id = b.blacklisted_by`;
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await pool.query(`SELECT COUNT(*)::int AS total ${fromSql} ${whereSql}`, params);
    params.push(limit, offset);
    const rows = await pool.query(`
      SELECT b.entity_type AS "entityType", b.identifier, b.entity_name AS "entityName",
        b.reason, b.status, u."userName" AS "blacklistedBy",
        TO_CHAR(b.blacklisted_at AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY') AS date,
        TO_CHAR(b.blacklisted_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS time
      ${fromSql} ${whereSql}
      ORDER BY b.blacklisted_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { data: rows.rows, pagination: { page, limit, totalRecords: total.rows[0]?.total || 0 } };
  },

  async getMaterialMovementReport(filters = {}) {
    const limit = normalizeLimit(filters.limit);
    const page = toPositiveInt(filters.page, 1);
    const offset = (page - 1) * limit;
    const params = [];
    const where = [];
    const eventTime = `COALESCE(pm."scannedAt", mpr."dateOfEntry", pm."createdAt")`;
    if (filters.fromDate) { params.push(filters.fromDate); where.push(`${eventTime} >= $${params.length}::date`); }
    if (filters.toDate) { params.push(filters.toDate); where.push(`${eventTime} < ($${params.length}::date + INTERVAL '1 day')`); }
    if (filters.movement) { params.push(filters.movement); where.push(`UPPER(pm.movement::text) = UPPER($${params.length})`); }
    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      where.push(`CONCAT_WS(' ', mpr."referenceNo", pm."materialPassNo", a."entityName", mpt.name, pm.movement::text, pm.status::text) ILIKE $${params.length}`);
    }
    const fromSql = `FROM pass_material pm JOIN material_pass_request mpr ON mpr.id = pm."materialPassRequestId" LEFT JOIN material_pass_type mpt ON mpt.id = pm."materialPassTypeId" LEFT JOIN "Agents" a ON a.id = mpr."agentId"`;
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await pool.query(`SELECT COUNT(*)::int AS total ${fromSql} ${whereSql}`, params);
    params.push(limit, offset);
    const rows = await pool.query(`
      SELECT mpr."referenceNo" AS "requestNumber", pm."materialPassNo",
        a."entityName" AS "companyName", mpt.name AS "materialType",
        pm.movement::text AS movement, pm.status::text AS status,
        TO_CHAR(${eventTime} AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY') AS date,
        TO_CHAR(${eventTime} AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS time
      ${fromSql} ${whereSql}
      ORDER BY ${eventTime} DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { data: rows.rows, pagination: { page, limit, totalRecords: total.rows[0]?.total || 0 } };
  },

  async getVehicleMasterReport(filters = {}) {
    const limit = normalizeLimit(filters.limit);
    const page = toPositiveInt(filters.page, 1);
    const offset = (page - 1) * limit;
    const params = [];
    const where = [];

    const addLike = (column, value) => {
      if (!value || !String(value).trim()) return;
      params.push(`%${String(value).trim()}%`);
      where.push(`${column} ILIKE $${params.length}`);
    };

    addLike(`mv."registrationNo"`, filters.vehicleNo);
    addLike(`vt.name`, filters.vehicleType);
    if (filters.companyNameOrCode) {
      params.push(`%${filters.companyNameOrCode.trim()}%`);
      where.push(`(
        a."entityName" ILIKE $${params.length}
        OR a."loginId" ILIKE $${params.length}
      )`);
    }
    if (filters.insuranceExpiryFrom) {
      params.push(filters.insuranceExpiryFrom);
      where.push(`mv."insuranceExpiry" >= $${params.length}::date`);
    }
    if (filters.insuranceExpiryTo) {
      params.push(filters.insuranceExpiryTo);
      where.push(`mv."insuranceExpiry" <= $${params.length}::date`);
    }
    if (filters.rcExpiryFrom) {
      params.push(filters.rcExpiryFrom);
      where.push(`mv."rcValidity" >= $${params.length}::date`);
    }
    if (filters.rcExpiryTo) {
      params.push(filters.rcExpiryTo);
      where.push(`mv."rcValidity" <= $${params.length}::date`);
    }
    if (filters.hasRcCopy === "yes") {
      where.push(`NULLIF(TRIM(mv."scannedCopyFilePath"), '') IS NOT NULL`);
    } else if (filters.hasRcCopy === "no") {
      where.push(`NULLIF(TRIM(mv."scannedCopyFilePath"), '') IS NULL`);
    }
    if (filters.status === "active") {
      where.push(`mv."isActive" = TRUE`);
    } else if (filters.status === "inactive") {
      where.push(`mv."isActive" = FALSE`);
    }

    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      where.push(`(
        mv."registrationNo" ILIKE $${params.length}
        OR vt.name ILIKE $${params.length}
        OR a."entityName" ILIKE $${params.length}
        OR a."loginId" ILIKE $${params.length}
        OR mv."scannedCopyFileName" ILIKE $${params.length}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const fromSql = `FROM master_vehicles mv
      LEFT JOIN vehicle_types vt ON vt.id = mv."vehicleTypeId"
      LEFT JOIN "Agents" a ON a.id = mv."agentId"`;
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total ${fromSql} ${whereSql}`,
      params,
    );
    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT mv."registrationNo" AS "vehicleNo",
        NULL::text AS "rcBookNo", vt.name AS "vehicleType",
        a."loginId" AS "companyCode", a."entityName" AS "companyName",
        mv."insuranceExpiry" AS "insuranceExpiryDate",
        mv."rcValidity" AS "rcExpiryDate",
        COALESCE(
          NULLIF(TRIM(mv."scannedCopyFileName"), ''),
          CASE WHEN NULLIF(TRIM(mv."scannedCopyFilePath"), '') IS NOT NULL THEN 'Available' END
        ) AS "rcBookCopy",
        CASE WHEN mv."isActive" THEN 'Active' ELSE 'Inactive' END AS status,
        TO_CHAR(mv."updatedAt" AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY') AS date,
        TO_CHAR(mv."updatedAt" AT TIME ZONE 'Asia/Kolkata', 'HH24:MI:SS') AS time
       ${fromSql} ${whereSql}
       ORDER BY mv."updatedAt" DESC, mv.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      data: dataResult.rows,
      limitation: 'Vehicle Master does not currently contain a separate RC Book Number field.',
      pagination: { page, limit, totalRecords: countResult.rows[0]?.total || 0 },
    };
  },

};

module.exports = Report;
