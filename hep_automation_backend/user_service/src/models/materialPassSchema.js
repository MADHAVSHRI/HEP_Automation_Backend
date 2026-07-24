const { pool } = require("../dbconfig/db");
const ReferenceNumber = require("./referenceNumberSchema");

const formatISTDateTime = (dateValue, isEndOfDay = false) => {
  if (!dateValue) return null;

  let dateStr;
  if (dateValue instanceof Date) {
    dateStr = dateValue.toISOString();
  } else if (typeof dateValue === "string") {
    dateStr = dateValue.trim();
  } else {
    return null;
  }

  // Try to extract full datetime: YYYY-MM-DD HH:MM:SS or YYYY-MM-DDTHH:MM:SS
  // This preserves the actual time from DB without UTC→IST shifting
  const dtMatch = dateStr.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/
  );
  if (dtMatch) {
    const [, year, month, day, hour, minute] = dtMatch;
    // Build IST datetime using the EXTRACTED time (not converted)
    const istDateStr = `${year}-${month}-${day}T${hour}:${minute}:00+05:30`;
    const d = new Date(istDateStr);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  }

  // Fallback: date only (YYYY-MM-DD)
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  const hour = isEndOfDay ? 23 : 0;
  const minute = isEndOfDay ? 59 : 0;
  const istDateStr = `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`;
  const d = new Date(istDateStr);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
};

const portLocations = {
  async getAllPortLocations() {
    const query = `
      SELECT id, name
      FROM locations
      ORDER BY name ASC
    `;

    const result = await pool.query(query);

    return result.rows;
  },
};


const materialPassRequest = { 
  async createRegularMaterialPass(payload) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const {
        agentId,
        purpose,
        purposeOther,
        concernedDepartment,
        location,
        locationOther,
        entryDate,
        expiryDate,
        returnables,
        nonReturnables,
      } = payload;

      //Generate Pass Request Reference Number
      let referenceNo;
      let passRequestId;
      let inserted = false;
      let retries = 0;

      while (!inserted && retries < 5) {
        referenceNo = await ReferenceNumber.generateMaterialPassReference(client);

        try {
          const query = `
            INSERT INTO material_pass_request
            (
                "referenceNo",
                "originType",
                "agentId",
                "concernedDepartmentId",
                "purposeOfVisitId",
                "purposeOther",
                "dateOfEntry",
                "expiryDate",
                "locationFrom",
                "locationTo",
                "locationOther",
                "submittedAt"
            )
            VALUES
            (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()
            )
            RETURNING id
          `;
          const passRequestResult = await client.query(query,  [
              referenceNo,
              "Agent",            // or "Department"
              agentId,
              concernedDepartment,
              purpose,
              purposeOther || null,
              entryDate,
              expiryDate,
              location,
              location,
              locationOther || null,
          ]);
          passRequestId = passRequestResult.rows[0].id;
          inserted = true;
        } catch (err) {
          if (err.code === "23505") {
            console.warn("Duplicate reference detected, retrying...");
            retries++;
          } else {
            throw err;
          }
        }
      }

      if (!inserted) {
        throw new Error("Failed to generate unique reference number");
      }

      const passMaterialQuery = `
        INSERT INTO pass_material
        (
            "materialPassRequestId",
            "materialPassTypeId",
            "movement",
            "rateId",
            "materialPassNo"
        )
        VALUES
        (
            $1,$2,$3,$4,$5
        )
        RETURNING id
      `;

      let returnablePassId = null;
      let nonReturnablePassId = null;

      async function findOrCreateMasterItem({
          name,
          unitId,
          materialPassTypeId,
          agentId,
      }) {

          // 1. Check if master item already exists
          const existingQuery = `
              SELECT id
              FROM master_items
              WHERE
                  LOWER(name) = LOWER($1)
                  AND "materialPassTypeId" = $2
                  AND "agentId" = $3
              LIMIT 1
          `;

          const existingResult = await client.query(existingQuery, [
              name,
              materialPassTypeId,
              agentId,
          ]);

          // 2. If found, update latest unit and return id
          if (existingResult.rows.length > 0) {

              const masterItemId = existingResult.rows[0].id;

              await client.query(
                  `
                  UPDATE master_items
                  SET
                      "unitId" = $1,
                      "updatedAt" = NOW()
                  WHERE id = $2
                  `,
                  [unitId, masterItemId]
              );

              return masterItemId;
          }

          // 3. Otherwise create a new master item
          const insertQuery = `
              INSERT INTO master_items
              (
                  name,
                  "materialPassTypeId",
                  "unitId",
                  "userType",
                  "agentId"
              )
              VALUES
              (
                  $1,$2,$3,$4,$5
              )
              RETURNING id
          `;

          const insertResult = await client.query(insertQuery, [
              name,
              materialPassTypeId,
              unitId,
              "Agent",
              agentId,
          ]);

          return insertResult.rows[0].id;
      }

      const materialListQuery = `
          INSERT INTO material_list
          (
              "passMaterialId",
              "masterItemId",
              "requestedQty",
              "actualMovedQty",
              "unitId"
          )
          VALUES
          (
              $1,$2,$3,$4,$5
          )
      `;

      if (returnables.length > 0) {
          // Create Returnable Pass
          const returnablePassNumber = await ReferenceNumber.generateReturnablePassNo(client);

          const returnableResult = await client.query(passMaterialQuery, [
              passRequestId,
              1,              // Returnable
              "IN",
              null,             // Hardcoded rate for now
              returnablePassNumber,
          ]);

          returnablePassId = returnableResult.rows[0].id;

          for (const material of returnables) {
              const masterItemId =
                  await findOrCreateMasterItem({
                      name: material.name.trim(),
                      unitId: material.unit,
                      materialPassTypeId: 1,
                      agentId,
                  });

              await client.query(materialListQuery, [
                  returnablePassId,
                  masterItemId,
                  material.quantity,
                  0,              // Nothing has moved yet
                  material.unit,
              ]);
          }
      }

      if (nonReturnables.length > 0) {
          // Create Non-Returnable Pass
          const nonReturnablePassNumber = await ReferenceNumber.generateNonReturnablePassNo(client);

          const nonReturnableResult = await client.query(passMaterialQuery, [
              passRequestId,
              2,              // Non Returnable
              "IN",
              null,              // Or 1 if same rate
              nonReturnablePassNumber,
          ]);

          nonReturnablePassId = nonReturnableResult.rows[0].id;

          for (const material of nonReturnables) {
              const masterItemId =
                  await findOrCreateMasterItem({
                      name: material.name.trim(),
                      unitId: material.unit,
                      materialPassTypeId: 2,
                      agentId,
                  });
              
              await client.query(materialListQuery, [
                  nonReturnablePassId,
                  masterItemId,
                  material.quantity,
                  0,
                  material.unit,
              ]);
          }
      }

      await client.query("COMMIT");
      return passRequestId

    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

   /*
  =====================================================
  COMPLETE MATERIAL PASS REVIEW
  Applies a decision (APPROVED/REJECTED/REVERTED) + remarks
  to each applicable pass_material row (returnable/non-returnable),
  then marks the parent request as processed by the admin.

  Note: unlike person/vehicle passes, admin work is "done" here
  regardless of outcome — REVERTED doesn't put it back in the
  admin queue, it flags hasRevertedPass so the agent can act on it.
  =====================================================
  */
  async completeMaterialPassReview(passRequestId, passes, userId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const PASS_TYPE_ID_MAP = {
        RETURNABLE: 1,
        NON_RETURNABLE: 2,
      };

      // Resolve reviewer's username — "approvedBy" is compared against
      // userName elsewhere (see processedByMe filter), so store the same way.
      let approvedByName = null;
      if (userId) {
        const userRes = await client.query(
          'SELECT "userName" FROM "users" WHERE id = $1',
          [userId]
        );
        if (userRes.rows.length > 0) {
          approvedByName = userRes.rows[0].userName;
        }
      }

      let anyReverted = false;

      const STATUS_MAP = {
        APPROVED: "Approved",
        REJECTED: "Rejected",
        REVERTED: "Reverted",
        PENDING: "Pending",
        EXPIRED: "Expired",
      };

      for (const pass of passes) {
        const { passType, decision, remarks } = pass;
        const materialPassTypeId = PASS_TYPE_ID_MAP[passType];

        if (!materialPassTypeId) {
          throw new Error(`Unknown passType: ${passType}`);
        }

        if (decision === "REVERTED") anyReverted = true;

       const dbStatus = STATUS_MAP[decision?.toUpperCase()];
        if (!dbStatus) {
          throw new Error(`Invalid decision: ${decision}`);
        }

        const updateQuery = `
          UPDATE pass_material
          SET
            "status" = $1,
            "rejectedReason" = $2,
            "qrUuid" = CASE
              WHEN $1::enum_pass_material_status = 'Approved' 
              AND "qrUuid" IS NULL
              THEN gen_random_uuid()
              ELSE "qrUuid"
            END
          WHERE "materialPassRequestId" = $3
            AND "materialPassTypeId" = $4
          RETURNING id, "qrUuid"
        `;

        const updateResult = await client.query(updateQuery, [
          dbStatus,
          remarks || null,
          passRequestId,
          materialPassTypeId,
        ]);

        if (updateResult.rows.length === 0) {
          throw new Error(
            `No ${passType} pass found for material pass request ${passRequestId}`
          );
        }
      }

      const updateRequestQuery = `
        UPDATE material_pass_request
        SET
          "status" = 'Completed',
          "hasRevertedPass" = $1,
          "approvedBy" = $2
        WHERE id = $3
        RETURNING id, "referenceNo", "status", "hasRevertedPass"
      `;

      const requestResult = await client.query(updateRequestQuery, [
        anyReverted,
        approvedByName,
        passRequestId,
      ]);

      if (requestResult.rows.length === 0) {
        throw new Error(`Material pass request ${passRequestId} not found`);
      }

      await client.query("COMMIT");

      return {
        passRequestId,
        status: requestResult.rows[0].status,
        hasRevertedPass: anyReverted,
      };

    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  // service
  async saveMaterialQrPdfPath(passId, qrPdfPath) {
    const query = `
      UPDATE pass_material
      SET "qrPdfPath" = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [qrPdfPath, passId]);

    return result.rows[0];
  },
};

const getMaterialPass = {
    async getSubmittedMaterialPassRequests(agentId, options = {}) {
      const {
        page = 1,
        limit = 10,
        search,
        status,      // ALL | SUBMITTED | UNDER_REVIEW | COMPLETED | REVERTED | REJECTED
        movement,    // ALL | IN | OUT
        dateFrom,
        dateTo,
      } = options;

      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
      const offset = (pageNum - 1) * limitNum;

      // ── Base filters: search, date range, movement — these scope BOTH the
      // paginated data and the status-breakdown counts. Status itself is
      // excluded here so the count cards always reflect the full breakdown
      // within the current search/date/movement scope. ──
      const baseConditions = [`mpr."agentId" = $1`, `mpr."isActive"`];
      const baseParams = [agentId];
      let idx = 2;

      if (search) {
        // Matches the reference number OR any item name inside either
        // material pass (returnable/non-returnable) belonging to the request.
        baseConditions.push(`(
          mpr."referenceNo" ILIKE $${idx}
          OR EXISTS (
            SELECT 1
            FROM pass_material pm_s
            JOIN material_list ml_s ON ml_s."passMaterialId" = pm_s.id
            JOIN master_items mi_s ON mi_s.id = ml_s."masterItemId"
            WHERE pm_s."materialPassRequestId" = mpr.id
              AND mi_s.name ILIKE $${idx}
          )
        )`);
        baseParams.push(`%${search}%`);
        idx++;
      }

      if (dateFrom) {
        baseConditions.push(`mpr."createdAt" >= $${idx}`);
        baseParams.push(`${dateFrom} 00:00:00`);
        idx++;
      }
      if (dateTo) {
        baseConditions.push(`mpr."createdAt" <= $${idx}`);
        baseParams.push(`${dateTo} 23:59:59`);
        idx++;
      }

      if (movement && movement !== "ALL") {
        baseConditions.push(`EXISTS (
          SELECT 1 FROM pass_material pm_m
          WHERE pm_m."materialPassRequestId" = mpr.id
            AND pm_m.movement = $${idx}
        )`);
        baseParams.push(movement);
        idx++;
      }

      const baseWhere = baseConditions.join(" AND ");

      // ── Status facet — only applied to the paginated data + its total count ──
      let statusCondition = "";
      const statusParams = [];
      let statusIdx = idx;

      if (status && status !== "ALL") {
        switch (status) {
          case "SUBMITTED":
          case "UNDER_REVIEW":
            // No distinct "under review" value in this enum — treated as
            // Submitted. Consider dropping the separate button on the frontend.
            statusCondition = ` AND mpr."status" = $${statusIdx}`;
            statusParams.push("Submitted");
            statusIdx += 1;
            break;

          case "COMPLETED":
            statusCondition = ` AND mpr."status" = $${statusIdx}`;
            statusParams.push("Completed");
            statusIdx += 1;
            break;

          case "REVERTED":
            statusCondition = ` AND mpr."hasRevertedPass" = true`;
            break;

          case "REJECTED":
            statusCondition = ` AND EXISTS (
              SELECT 1 FROM pass_material pm_r
              WHERE pm_r."materialPassRequestId" = mpr.id
                AND pm_r.status = 'Rejected'
            )`;
            break;

          default:
            break;
        }
      }

      const dataParams = [...baseParams, ...statusParams];
      const dataWhere = `${baseWhere}${statusCondition}`;

      // ---- Total matching records (drives pagination) ----
      const countQuery = `
          SELECT COUNT(*)::int AS total
          FROM material_pass_request mpr
          WHERE ${dataWhere};
      `;
      const countRes = await pool.query(countQuery, dataParams);
      const totalRecords = countRes.rows[0]?.total || 0;
      const totalPages = Math.max(Math.ceil(totalRecords / limitNum), 1);

      // ---- Status breakdown (search/date/movement scoped, status-filter agnostic) ----
      const countsQuery = `
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE mpr."status" = 'Submitted')::int AS submitted,
            COUNT(*) FILTER (WHERE mpr."status" = 'Submitted')::int AS "underReview",
            COUNT(*) FILTER (WHERE mpr."status" = 'Completed')::int AS completed,
            COUNT(*) FILTER (WHERE mpr."hasRevertedPass" = true)::int AS reverted,
            COUNT(*) FILTER (
              WHERE EXISTS (
                SELECT 1 FROM pass_material pm_c
                WHERE pm_c."materialPassRequestId" = mpr.id
                  AND pm_c.status = 'Rejected'
              )
            )::int AS rejected
          FROM material_pass_request mpr
          WHERE ${baseWhere};
      `;
      const countsRes = await pool.query(countsQuery, baseParams);
      const counts = countsRes.rows[0] || {
        total: 0,
        submitted: 0,
        underReview: 0,
        completed: 0,
        reverted: 0,
        rejected: 0,
      };

      // ---- Paginated data ----
      const limitParamIdx = statusIdx;
      const offsetParamIdx = statusIdx + 1;

      const materialQuery = `
          SELECT
              mpr.id,
              mpr."referenceNo",
              mpr."status",

              a."entityName" AS "companyName",

              mpr."dateOfEntry" AS "entryDate",
              mpr."expiryDate",
              mpr."hasRevertedPass",
              mpr."submittedAt",
              mpr."createdAt",

              vp."name" AS "purpose",
              mpr."purposeOther",

              pd."departmentName" AS "concernedDepartment",

              lf.name AS "locationFrom",
              lt.name AS "locationTo",
              mpr."locationOther",

              rp."returnablePass" AS "returnablePass",
              nrp."nonReturnablePass" AS "nonReturnablePass"

          FROM material_pass_request mpr

          LEFT JOIN "Agents" a
              ON a.id = mpr."agentId"

          LEFT JOIN visit_purposes vp
              ON vp.id = mpr."purposeOfVisitId"

          LEFT JOIN port_departments pd
              ON pd.id = mpr."concernedDepartmentId"

          LEFT JOIN locations lf
              ON lf.id = mpr."locationFrom"

          LEFT JOIN locations lt
              ON lt.id = mpr."locationTo"

          LEFT JOIN (
              SELECT
                  pm."materialPassRequestId",
                  jsonb_build_object(
                      'id', pm.id,
                      'status', pm.status,
                      'movement', pm.movement,
                      'rejectedReason', pm."rejectedReason",
                      'scannedAt', pm."scannedAt",
                      'materials',
                      COALESCE(
                          jsonb_agg(
                              jsonb_build_object(
                                  'name', mi.name,
                                  'quantity', ml."requestedQty",
                                  'unit', u."unitName"
                              )
                          ), '[]'::jsonb
                      )
                  ) AS "returnablePass"
              FROM pass_material pm
              JOIN material_list ml ON ml."passMaterialId" = pm.id
              JOIN master_items mi ON mi.id = ml."masterItemId"
              JOIN units u ON u.id = ml."unitId"
              WHERE pm."materialPassTypeId" = 1
              GROUP BY pm.id, pm."materialPassRequestId"
          ) rp
          ON rp."materialPassRequestId" = mpr.id

          LEFT JOIN (
              SELECT
                  pm."materialPassRequestId",
                  jsonb_build_object(
                      'id', pm.id,
                      'status', pm.status,
                      'movement', pm.movement,
                      'rejectedReason', pm."rejectedReason",
                      'scannedAt', pm."scannedAt",
                      'materials',
                      COALESCE(
                          jsonb_agg(
                              jsonb_build_object(
                                  'name', mi.name,
                                  'quantity', ml."requestedQty",
                                  'unit', u."unitName"
                              )
                          ), '[]'::jsonb
                      )
                  ) AS "nonReturnablePass"
              FROM pass_material pm
              JOIN material_list ml ON ml."passMaterialId" = pm.id
              JOIN master_items mi ON mi.id = ml."masterItemId"
              JOIN units u ON u.id = ml."unitId"
              WHERE pm."materialPassTypeId" = 2
              GROUP BY pm.id, pm."materialPassRequestId"
          ) nrp
          ON nrp."materialPassRequestId" = mpr.id

          WHERE ${dataWhere}
          ORDER BY mpr."createdAt" DESC
          LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx};
      `;

      const dataQueryParams = [...dataParams, limitNum, offset];
      const submittedRequestsRes = await pool.query(materialQuery, dataQueryParams);

      return {
        rows: submittedRequestsRes.rows,
        pagination: {
          totalRecords,
          totalPages,
          currentPage: pageNum,
          pageSize: limitNum,
        },
        counts,
      };
    },

    async getMaterialPassRequestsToApproverAdmin(departmentId, pagination = {}) {
        const {
            page   = 1,
            limit  = 20,
            offset = 0,
            search = "",
            status = "",
            sortOrder = "DESC",
            processedByMe = false,
            userId = null,
        } = pagination;

        let approvedByUserName = null;
        if (processedByMe && userId) {
            try {
            const userRes = await pool.query('SELECT "userName" FROM "users" WHERE id = $1', [userId]);
            if (userRes.rows.length > 0) {
                approvedByUserName = userRes.rows[0].userName;
            }
            } catch (err) {
            console.error("Error looking up user for processedByMe filter:", err);
            }
        }

        // ⚠️ Verify these against your actual material_pass_request status enum
        const PENDING_STATUSES = ["Draft", "Submitted",];
        const PROCESSED_STATUSES = ["Completed",];

        // ─── Search filter SQL builder ───
        let searchFilter = "";
        const searchParams = [];
        let paramIdx = 2; // $1 is always departmentId

        if (search) {
            const searchParam = `%${search}%`;
            searchParams.push(searchParam);
            searchFilter = `
            AND (
                mpr."referenceNo" ILIKE $${paramIdx}
                OR EXISTS (
                SELECT 1 FROM "Agents" a
                WHERE a.id = mpr."agentId" AND a."entityName" ILIKE $${paramIdx}
                )
                OR EXISTS (
                SELECT 1
                FROM pass_material pm
                JOIN material_list ml ON ml."passMaterialId" = pm.id
                JOIN master_items mi ON mi.id = ml."masterItemId"
                WHERE pm."materialPassRequestId" = mpr.id
                AND mi.name ILIKE $${paramIdx}
                )
            )`;
            paramIdx++;
        }

        // ─── Status filter ───
        let statusFilter = "";
        if (status === "pending") {
            statusFilter = `AND mpr.status::TEXT IN ('${PENDING_STATUSES.join("','")}')`;
        } else if (status === "processed") {
            statusFilter = `AND mpr.status::TEXT IN ('${PROCESSED_STATUSES.join("','")}')`;
            if (processedByMe && approvedByUserName) {
            statusFilter += ` AND mpr."approvedBy" = $${paramIdx}`;
            searchParams.push(approvedByUserName);
            paramIdx++;
            }
        }

        /* =============================================
            QUERY 1 — Global Counts (lightweight)
        ============================================= */
        const countParams = [departmentId];
        let countSQL = `
            SELECT
            COUNT(*) AS total,
            COUNT(CASE WHEN mpr.status::TEXT IN ('${PENDING_STATUSES.join("','")}') THEN 1 END) AS pending,
            COUNT(CASE WHEN mpr.status::TEXT IN ('${PROCESSED_STATUSES.join("','")}')
                ${processedByMe && approvedByUserName ? `AND mpr."approvedBy" = $2` : ""}
            THEN 1 END) AS processed
            FROM material_pass_request mpr
            WHERE mpr."concernedDepartmentId" = $1
            AND mpr."isActive"
        `;
        if (processedByMe && approvedByUserName) {
            countParams.push(approvedByUserName);
        }

        const countRes = await pool.query(countSQL, countParams);
        const c = countRes.rows[0];
        const counts = {
            pending:   parseInt(c.pending),
            processed: parseInt(c.processed),
            total:     parseInt(c.total),
        };

        /* =============================================
            QUERY 2 — Paginated IDs
        ============================================= */
        const limitParam  = paramIdx;
        const offsetParam = paramIdx + 1;
        const paginationParams = [departmentId, ...searchParams, limit, offset];

        const idQuery = `
            SELECT mpr.id, mpr."createdAt"
            FROM material_pass_request mpr
            WHERE mpr."concernedDepartmentId" = $1
            AND mpr."isActive"
            ${searchFilter}
            ${statusFilter}
            ORDER BY mpr."createdAt" ${sortOrder}
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `;

        const idResult = await pool.query(idQuery, paginationParams);
        const pageIds = idResult.rows.map(r => r.id);

        if (pageIds.length === 0) {
            return { data: [], counts };
        }

        /* =============================================
            QUERY 3 — Full Detail Hydration (only page IDs)
        ============================================= */
        const placeholders = pageIds.map((_, i) => `$${i + 1}`).join(",");

        const detailQuery = `
            SELECT
            mpr.id,
            mpr."referenceNo",
            mpr."status",

            a."entityName" AS "companyName",

            mpr."dateOfEntry" AS "entryDate",
            mpr."expiryDate",
            mpr."hasRevertedPass",
            mpr."submittedAt",
            mpr."createdAt",
            mpr."approvedBy",

            vp.name AS "purpose",
            mpr."purposeOther",

            pd."departmentName" AS "concernedDepartment",
            pd.id AS "concernedDepartmentId",

            lf.name AS "locationFrom",
            lt.name AS "locationTo",
            mpr."locationOther",

            rp."returnablePass",
            nrp."nonReturnablePass"

            FROM material_pass_request mpr

            LEFT JOIN "Agents" a
            ON a.id = mpr."agentId"

            LEFT JOIN visit_purposes vp
            ON vp.id = mpr."purposeOfVisitId"

            LEFT JOIN port_departments pd
            ON pd.id = mpr."concernedDepartmentId"

            LEFT JOIN locations lf
            ON lf.id = mpr."locationFrom"

            LEFT JOIN locations lt
            ON lt.id = mpr."locationTo"

            LEFT JOIN (
            SELECT
                pm."materialPassRequestId",
                jsonb_build_object(
                'status', pm.status,
                'movement', pm.movement,
                'rejectedReason', pm."rejectedReason",
                'scannedAt', pm."scannedAt",
                'materials',
                COALESCE(
                    jsonb_agg(
                    jsonb_build_object(
                        'name', mi.name,
                        'quantity', ml."requestedQty",
                        'unit', u."unitName"
                    )
                    ), '[]'::jsonb
                )
                ) AS "returnablePass"
            FROM pass_material pm
            JOIN material_list ml ON ml."passMaterialId" = pm.id
            JOIN master_items mi ON mi.id = ml."masterItemId"
            JOIN units u ON u.id = ml."unitId"
            WHERE pm."materialPassTypeId" = 1
            GROUP BY pm.id, pm."materialPassRequestId"
            ) rp ON rp."materialPassRequestId" = mpr.id

            LEFT JOIN (
            SELECT
                pm."materialPassRequestId",
                jsonb_build_object(
                'status', pm.status,
                'movement', pm.movement,
                'rejectedReason', pm."rejectedReason",
                'scannedAt', pm."scannedAt",
                'materials',
                COALESCE(
                    jsonb_agg(
                    jsonb_build_object(
                        'name', mi.name,
                        'quantity', ml."requestedQty",
                        'unit', u."unitName"
                    )
                    ), '[]'::jsonb
                )
                ) AS "nonReturnablePass"
            FROM pass_material pm
            JOIN material_list ml ON ml."passMaterialId" = pm.id
            JOIN master_items mi ON mi.id = ml."masterItemId"
            JOIN units u ON u.id = ml."unitId"
            WHERE pm."materialPassTypeId" = 2
            GROUP BY pm.id, pm."materialPassRequestId"
            ) nrp ON nrp."materialPassRequestId" = mpr.id

            WHERE mpr.id IN (${placeholders})
            ORDER BY mpr."createdAt" ${sortOrder}
        `;

        const detailRes = await pool.query(detailQuery, pageIds);

        return { data: detailRes.rows, counts };
        },

     /*
  =====================================================
  GET MATERIAL PASS BY ID
  Mirrors the detail shape from getMaterialPassRequestsToApproverAdmin,
  plus agent contact fields needed for the revert-notification email.
  =====================================================
  */
  async getMaterialPassById(passRequestId) {
    const query = `
      SELECT
        mpr.id,
        mpr."referenceNo",
        mpr."status",

        a."entityName" AS "companyName",
        a."email" AS "agentEmail",
        a."contactPersonName" AS "agentName",

        mpr."dateOfEntry" AS "entryDate",
        mpr."expiryDate",
        mpr."hasRevertedPass",
        mpr."submittedAt",
        mpr."createdAt",
        mpr."approvedBy",

        vp.name AS "purpose",
        mpr."purposeOther",

        pd."departmentName" AS "concernedDepartment",

        lf.name AS "locationFrom",
        lt.name AS "locationTo",
        mpr."locationOther",

        rp."returnablePass",
        nrp."nonReturnablePass"

      FROM material_pass_request mpr

      LEFT JOIN "Agents" a
        ON a.id = mpr."agentId"

      LEFT JOIN visit_purposes vp
        ON vp.id = mpr."purposeOfVisitId"

      LEFT JOIN port_departments pd
        ON pd.id = mpr."concernedDepartmentId"

      LEFT JOIN locations lf
        ON lf.id = mpr."locationFrom"

      LEFT JOIN locations lt
        ON lt.id = mpr."locationTo"

      LEFT JOIN (
        SELECT
          pm."materialPassRequestId",
          jsonb_build_object(
            'status', pm.status,
            'movement', pm.movement,
            'rejectedReason', pm."rejectedReason",
            'scannedAt', pm."scannedAt",
            'materials',
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'name', mi.name,
                  'quantity', ml."requestedQty",
                  'unit', u."unitName"
                )
              ), '[]'::jsonb
            )
          ) AS "returnablePass"
        FROM pass_material pm
        JOIN material_list ml ON ml."passMaterialId" = pm.id
        JOIN master_items mi ON mi.id = ml."masterItemId"
        JOIN units u ON u.id = ml."unitId"
        WHERE pm."materialPassTypeId" = 1
        GROUP BY pm.id, pm."materialPassRequestId"
      ) rp ON rp."materialPassRequestId" = mpr.id

      LEFT JOIN (
        SELECT
          pm."materialPassRequestId",
          jsonb_build_object(
            'status', pm.status,
            'movement', pm.movement,
            'rejectedReason', pm."rejectedReason",
            'scannedAt', pm."scannedAt",
            'materials',
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'name', mi.name,
                  'quantity', ml."requestedQty",
                  'unit', u."unitName"
                )
              ), '[]'::jsonb
            )
          ) AS "nonReturnablePass"
        FROM pass_material pm
        JOIN material_list ml ON ml."passMaterialId" = pm.id
        JOIN master_items mi ON mi.id = ml."masterItemId"
        JOIN units u ON u.id = ml."unitId"
        WHERE pm."materialPassTypeId" = 2
        GROUP BY pm.id, pm."materialPassRequestId"
      ) nrp ON nrp."materialPassRequestId" = mpr.id

      WHERE mpr.id = $1
    `;

    const result = await pool.query(query, [passRequestId]);
    return result.rows[0] || null;
  },

    async getMaterialQrData(passRequestId, type, passId) {
      if (!passRequestId || !type || !passId) {
        throw new Error("passRequestId, type and passId are required");
      }

      const materialPassTypeId =
        type === "returnable" ? 1 : type === "nonReturnable" ? 2 : null;

      if (!materialPassTypeId) {
        throw new Error("Invalid pass type");
      }

      // 1. The pass_material row itself (must be Approved) + its parent request info.
      const passQuery = `
        SELECT
          pm.id,
          pm."materialPassRequestId",
          pm."materialPassTypeId",
          pm.movement,
          pm.status,
          pm."materialPassNo",
          pm."qrUuid",
          pm."scannedAt",

          mpr."referenceNo",
          mpr."dateOfEntry"   AS "entryDate",
          mpr."expiryDate",
          mpr."locationOther",

          lf.name AS "locationFromName",
          lt.name AS "locationToName",
          pd."departmentName" AS "concernedDepartment",
          vp.name AS purpose,
          mpr."purposeOther",
          a."entityName" AS "companyName"

        FROM pass_material pm
        JOIN material_pass_request mpr
          ON mpr.id = pm."materialPassRequestId"
        JOIN "Agents" a
          ON a.id = mpr."agentId"
        LEFT JOIN locations lf
          ON lf.id = mpr."locationFrom"
        LEFT JOIN locations lt
          ON lt.id = mpr."locationTo"
        LEFT JOIN port_departments pd
          ON pd.id = mpr."concernedDepartmentId"
        LEFT JOIN visit_purposes vp
          ON vp.id = mpr."purposeOfVisitId"

        WHERE pm."materialPassRequestId" = $1
          AND pm.id = $2
          AND pm."materialPassTypeId" = $3
          AND pm."isActive" = true
          AND pm.status = 'Approved'
        LIMIT 1
      `;

      const passResult = await pool.query(passQuery, [
        passRequestId,
        passId,
        materialPassTypeId,
      ]);

      if (passResult.rows.length === 0) {
        throw new Error("Approved material pass not found");
      }

      const passRow = passResult.rows[0];

      // 2. Line items for this specific pass_material row.
      const materialsQuery = `
        SELECT
          mi.name,
          ml."requestedQty" AS quantity,
          u."unitName" AS unit
        FROM material_list ml
        JOIN master_items mi ON mi.id = ml."masterItemId"
        JOIN units u ON u.id = ml."unitId"
        WHERE ml."passMaterialId" = $1
        ORDER BY ml.id ASC
      `;

      const materialsResult = await pool.query(materialsQuery, [passId]);

      const pass = {
        id: passRow.id,
        materialPassNo: passRow.materialPassNo,
        qrUuid: passRow.qrUuid,
        movement: passRow.movement,
        status: passRow.status,
        validFrom: formatISTDateTime(passRow.entryDate, false),
        validTo: formatISTDateTime(passRow.expiryDate, false),
        materials: materialsResult.rows,
      };

      return {
        type,
        passRequestId: passRow.materialPassRequestId,
        referenceNo: passRow.referenceNo,
        companyName: passRow.companyName,
        concernedDepartment: passRow.concernedDepartment,
        purpose: passRow.purposeOther || passRow.purpose,
        locationFrom: passRow.locationFromName,
        locationTo: passRow.locationToName,
        locationOther: passRow.locationOther,
        entryDate: passRow.entryDate,
        expiryDate: passRow.expiryDate,
        pass,
      };
    },
}

module.exports = {
    portLocations,
    materialPassRequest,
    getMaterialPass,
};