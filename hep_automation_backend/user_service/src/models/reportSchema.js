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
      where.push(`entry."createdAt" >= $${params.length}`);
    }

    if (filters.toDate) {
      params.push(filters.toDate);
      where.push(`entry."createdAt" <= $${params.length}`);
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
};

module.exports = Report;
