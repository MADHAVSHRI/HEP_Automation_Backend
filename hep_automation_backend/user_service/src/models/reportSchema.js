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
  async getAllPassIssuanceOptions() {
    const [
      companyTypes,
      passTypes,
      approvalStatuses,
      passHolderTypes,
      nationalities,
      departments,
      paymentTypes,
      cardTypes,
      issuedCardTypes,
      passRequestTypes,
      transactionTypes,
      paymentStatuses,
    ] = await Promise.all([
      this.getRegisteredUserOptions(),
      pool.query(`
        SELECT e.enumlabel AS value
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'enum_pass_persons_passType'
        ORDER BY e.enumsortorder
      `).then((result) => result.rows.map((row) => row.value)),
      pool.query(`
        SELECT e.enumlabel AS value
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'enum_pass_requests_status'
        ORDER BY e.enumsortorder
      `).then((result) => result.rows.map((row) => row.value)),
      pool.query(`
        SELECT name AS value
        FROM hep_types
        WHERE "isActive" = true AND name IS NOT NULL AND TRIM(name) <> ''
        ORDER BY name
      `).then((result) => result.rows.map((row) => row.value)),
      pool.query(`
        SELECT e.enumlabel AS value
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'enum_pass_persons_nationality'
        ORDER BY e.enumsortorder
      `).then((result) => result.rows.map((row) => row.value)),
      pool.query(`
        SELECT "departmentName" AS value
        FROM port_departments
        WHERE "departmentName" IS NOT NULL AND TRIM("departmentName") <> ''
        ORDER BY "departmentName"
      `).then((result) => result.rows.map((row) => row.value)),
      pool.query(`
        SELECT DISTINCT e.enumlabel AS value
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname IN (
          'enum_pass_requests_paymentMode',
          'enum_vendor_pass_requests_paymentMode',
          'enum_bulk_pass_batches_paymentMode',
          'enum_material_pass_request_paymentMode'
        )
        ORDER BY value
      `).then((result) => result.rows.map((row) => row.value)),
      pool.query(`
        SELECT DISTINCT value
        FROM (
          SELECT CASE WHEN name ILIKE 'Driver%' THEN 'Driver' ELSE 'Person' END AS value
          FROM hep_types
          WHERE "isActive" = true

          UNION ALL

          SELECT 'Vehicle' AS value
          WHERE EXISTS (SELECT 1 FROM pass_vehicles)
             OR EXISTS (SELECT 1 FROM vendor_pass_vehicles)
        ) card_types
        WHERE value IS NOT NULL
        ORDER BY value
      `).then((result) => result.rows.map((row) => row.value)),
      pool.query(`
        SELECT DISTINCT value
        FROM (
          SELECT CASE WHEN name ILIKE 'Driver%' THEN 'Driver' ELSE 'Individual' END AS value
          FROM hep_types
          WHERE "isActive" = true

          UNION ALL

          SELECT 'Vehicle' AS value
          WHERE EXISTS (SELECT 1 FROM pass_vehicles)
             OR EXISTS (SELECT 1 FROM vendor_pass_vehicles)
        ) issued_card_types
        WHERE value IS NOT NULL
        ORDER BY value
      `).then((result) => result.rows.map((row) => row.value)),
      pool.query(`
        SELECT e.enumlabel AS value
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'enum_pass_requests_originType'
        ORDER BY e.enumsortorder
      `).then((result) => result.rows.map((row) => row.value)),
      pool.query(`
        SELECT value, label
        FROM report_filter_options
        WHERE "groupKey" = 'revenue_transaction_type' AND "isActive" = true
        ORDER BY "sortOrder", label
      `).then((result) => result.rows),
      pool.query(`
        SELECT DISTINCT status AS value
        FROM (
          SELECT NULLIF(TRIM(status), '') AS status FROM overstay_charges
          UNION ALL
          SELECT NULLIF(TRIM(status), '') AS status FROM blacklist_entries
        ) payment_statuses
        WHERE status IS NOT NULL
        ORDER BY status
      `).then((result) => result.rows.map((row) => row.value)),
    ]);

    return {
      companyTypes: companyTypes.map((row) => row.name),
      passTypes,
      approvalStatuses,
      passHolderTypes,
      nationalities,
      departments,
      paymentTypes,
      cardTypes,
      issuedCardTypes,
      passRequestTypes,
      transactionTypes,
      paymentStatuses,
    };
  },

  async getAllPassIssuanceReport(filters = {}) {
    const limit = normalizeLimit(filters.limit);
    const page = toPositiveInt(filters.page, 1);
    const offset = (page - 1) * limit;
    const params = [];
    const where = [];

    const addFilter = (value, expression, wildcard = false) => {
      if (!value || !String(value).trim()) return;
      params.push(wildcard ? `%${String(value).trim()}%` : String(value).trim());
      where.push(`${expression} $${params.length}`);
    };

    addFilter(filters.fromDate, `entry."createdAt" >=`);
    addFilter(filters.toDate, `entry."createdAt" <=`);
    addFilter(filters.passId, `entry."passId" ILIKE`, true);
    addFilter(filters.cardHolder, `entry."cardHolder" ILIKE`, true);
    addFilter(filters.idProof, `entry."idProof" ILIKE`, true);
    addFilter(filters.companyCodeOrName, `entry."companySearch" ILIKE`, true);
    addFilter(filters.companyType, `entry."companyType" =`);
    addFilter(filters.passType, `entry."passType" =`);
    if (filters.approvalStatus) {
      params.push(filters.approvalStatus.trim().toUpperCase());
      where.push(`UPPER(entry."approvalStatus") = $${params.length}`);
    }
    addFilter(filters.passHolderType, `entry."passHolderType" =`);
    if (filters.nationality) {
      params.push(filters.nationality.trim().toUpperCase());
      where.push(`UPPER(entry.nationality) = $${params.length}`);
    }
    addFilter(filters.department, `entry.department =`);
    addFilter(filters.paymentType, `entry."paymentType" =`);
    addFilter(filters.aadhaar, `entry.aadhaar ILIKE`, true);

    const baseQuery = `
      WITH entry AS (
        SELECT
          'STANDARD'::text AS source,
          COALESCE(pp."personPassNo", pr."referenceNo")::text AS "passId",
          pp.name::text AS "cardHolder",
          COALESCE(ht.name, 'Personnel')::text AS "passHolderType",
          COALESCE(pp."idProofNumber", pp."aadharNo")::text AS "idProof",
          pp."aadharNo"::text AS aadhaar,
          pp.nationality::text AS nationality,
          pp."passType"::text AS "passType",
          a."loginId"::text AS "companyCode",
          a."entityName"::text AS "companyName",
          CONCAT_WS(' ', a."loginId", a."entityName")::text AS "companySearch",
          a."userTypeName"::text AS "companyType",
          pp.status::text AS "approvalStatus",
          NULL::text AS department,
          pr."paymentMode"::text AS "paymentType",
          pp."dateFrom",
          pp."dateTo",
          pp.amount,
          pp."createdAt"
        FROM pass_persons pp
        JOIN pass_requests pr ON pr.id = pp."passRequestId"
        LEFT JOIN "Agents" a ON a.id = pr."agentId"
        LEFT JOIN hep_types ht ON ht.id = pp."hepTypeId"

        UNION ALL

        SELECT
          'STANDARD', COALESCE(pv."vehiclePassNo", pr."referenceNo"), pv."registrationNo",
          'Vehicle', pv."registrationNo", NULL, NULL, pv."passType"::text,
          a."loginId", a."entityName", CONCAT_WS(' ', a."loginId", a."entityName"),
          a."userTypeName", pv.status::text, NULL, pr."paymentMode"::text,
          pv."dateFrom", pv."dateTo", pv.amount, pv."createdAt"
        FROM pass_vehicles pv
        JOIN pass_requests pr ON pr.id = pv."passRequestId"
        LEFT JOIN "Agents" a ON a.id = pr."agentId"

        UNION ALL

        SELECT
          'VENDOR', COALESCE(vpp."personPassNo", vpr."referenceNo"), vpp.name,
          COALESCE(ht.name, 'Personnel'), COALESCE(vpp."idProofNumber", vpp."aadharNo"),
          vpp."aadharNo", vpp.nationality::text, vpp."passType"::text,
          vpr."referenceNo", vpr."companyName", CONCAT_WS(' ', vpr."referenceNo", vpr."companyName"),
          'Vendor', vpp.status::text, vpr."departmentName", vpr."paymentMode"::text,
          vpp."dateFrom", vpp."dateTo", vpp.amount, vpp."createdAt"
        FROM vendor_pass_persons vpp
        JOIN vendor_pass_requests vpr ON vpr.id = vpp."vendorPassRequestId"
        LEFT JOIN hep_types ht ON ht.id = vpp."hepTypeId"

        UNION ALL

        SELECT
          'VENDOR', COALESCE(vpv."vehiclePassNo", vpr."referenceNo"), vpv."vehicleRegistrationNo",
          'Vehicle', vpv."vehicleRegistrationNo", NULL, NULL, vpv."passType"::text,
          vpr."referenceNo", vpr."companyName", CONCAT_WS(' ', vpr."referenceNo", vpr."companyName"),
          'Vendor', vpv.status::text, vpr."departmentName", vpr."paymentMode"::text,
          vpv."dateFrom", vpv."dateTo", vpv.amount, vpv."createdAt"
        FROM vendor_pass_vehicles vpv
        JOIN vendor_pass_requests vpr ON vpr.id = vpv."vendorPassRequestId"

        UNION ALL

        SELECT
          'MATERIAL', COALESCE(pm."materialPassNo", mpr."referenceNo"), COALESCE(mpt.name, 'Material'),
          'Material', mpr."referenceNo", NULL, NULL, NULL,
          a."loginId", a."entityName", CONCAT_WS(' ', a."loginId", a."entityName"),
          a."userTypeName", pm.status::text, pd."departmentName", mpr."paymentMode"::text,
          mpr."dateOfEntry", mpr."expiryDate", mpr."netAmount", pm."createdAt"
        FROM pass_material pm
        JOIN material_pass_request mpr ON mpr.id = pm."materialPassRequestId"
        LEFT JOIN material_pass_type mpt ON mpt.id = pm."materialPassTypeId"
        LEFT JOIN "Agents" a ON a.id = mpr."agentId"
        LEFT JOIN port_departments pd ON pd.id = mpr."concernedDepartmentId"

        UNION ALL

        SELECT
          'BULK', bpb."refNo", COALESCE(bpp.name, bpp."vehicleNumber"),
          CASE WHEN bpp."vehicleNumber" IS NULL THEN 'Personnel' ELSE 'Vehicle' END,
          bpp.aadhaar, bpp.aadhaar, NULL, NULL,
          bpb."refNo", bpb."companyName", CONCAT_WS(' ', bpb."refNo", bpb."companyName"),
          bpb."visitorType", bpb.status::text, bpb."departmentName", bpb."paymentMode"::text,
          bpb."validityFrom", bpb."validityUpto", NULL, bpp."createdAt"
        FROM bulk_pass_persons bpp
        JOIN bulk_pass_batches bpb ON bpb.id = bpp."batchId"

        UNION ALL

        SELECT
          'VVIP', vvr."referenceNo", vvp.name, 'VVIP Person', vvp."idProofNo",
          NULL, NULL, NULL, vvr."referenceNo", vvr."departmentName",
          CONCAT_WS(' ', vvr."referenceNo", vvr."departmentName"), 'Department',
          vvr.status::text, vvr."departmentName", NULL,
          vvr."validityFrom", vvr."validityTo", NULL, vvp."createdAt"
        FROM vvip_pass_persons vvp
        JOIN vvip_pass_requests vvr ON vvr.id = vvp."requestId"

        UNION ALL

        SELECT
          'VVIP', vvr."referenceNo", vv."vehicleNo", 'VVIP Vehicle', vv."vehicleNo",
          NULL, NULL, NULL, vvr."referenceNo", vvr."departmentName",
          CONCAT_WS(' ', vvr."referenceNo", vvr."departmentName"), 'Department',
          vvr.status::text, vvr."departmentName", NULL,
          vvr."validityFrom", vvr."validityTo", NULL, vv."createdAt"
        FROM vvip_pass_vehicles vv
        JOIN vvip_pass_requests vvr ON vvr.id = vv."requestId"
      )
    `;

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countResult = await pool.query(
      `${baseQuery} SELECT COUNT(*)::int AS total FROM entry ${whereSql}`,
      params,
    );

    const dataParams = [...params, limit, offset];
    const dataResult = await pool.query(
      `${baseQuery}
       SELECT * FROM entry ${whereSql}
       ORDER BY "createdAt" DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
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
