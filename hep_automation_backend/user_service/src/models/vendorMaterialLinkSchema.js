const { pool } = require("../dbconfig/db");

const ReferenceNumber = require("./referenceNumberSchema");

const ALLOWED_SORT_COLUMNS = {
  createdAt: 'vml."createdAt"',
  companyName: 'vml."companyName"',
  validFrom: 'vml."validFrom"',
  validTo: 'vml."validTo"',
  status: 'vml."status"',
  referenceNo: 'vml."referenceNo"',
};

class SubmissionError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "SubmissionError";
    this.status = status;
  }
}

function formatIstDate(value) {
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    throw new Error(
      "Invalid database date."
    );
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(date);

  const values =
    Object.fromEntries(
      parts.map(
        ({ type, value }) => [
          type,
          value,
        ]
      )
    );

  return [
    values.year,
    values.month,
    values.day,
  ].join("-");
}

function getEffectiveStatus(row) {
  if (
    [
      "REVOKED",
      "DISABLED",
      "EXPIRED",
    ].includes(row.status)
  ) {
    return row.status;
  }

  return formatIstDate(row.validTo) <
    formatIstDate(new Date())
    ? "EXPIRED"
    : row.status;
}

async function findOrCreateMasterItem(
  client,
  {
    linkId,
    name,
    materialType,
    unitId,
  }
) {
  // Link row is locked by the caller, so submissions
  // through this link cannot race this lookup.
  const existing = await client.query(
    `
      SELECT id
      FROM vendor_master_items
      WHERE "vendorMaterialLinkId" = $1
        AND LOWER(name) = LOWER($2)
        AND "materialType" = $3
      LIMIT 1
    `,
    [
      linkId,
      name,
      materialType,
    ]
  );

  if (existing.rows.length) {
    const id = existing.rows[0].id;

    await client.query(
      `
        UPDATE vendor_master_items
        SET
          "lastUsedUnitId" = $2,
          "isActive" = TRUE,
          "updatedAt" = NOW()
        WHERE id = $1
      `,
      [id, unitId]
    );

    return id;
  }

  const inserted = await client.query(
    `
      INSERT INTO vendor_master_items (
        "vendorMaterialLinkId",
        name,
        "materialType",
        "lastUsedUnitId",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1, $2, $3, $4,
        TRUE, NOW(), NOW()
      )
      RETURNING id
    `,
    [
      linkId,
      name,
      materialType,
      unitId,
    ]
  );

  return inserted.rows[0].id;
}

function parseGateIds(
  value,
  {
    required = false,
    fieldName = "Gate selection",
  } = {}
) {
  let input = value;

  /*
   * Link generation uses multipart/form-data.
   * Gate IDs may therefore arrive as JSON text.
   */
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      throw new SubmissionError(
        422,
        `${fieldName} must be a valid array.`
      );
    }
  }

  if (input === undefined) {
    input = [];
  }

  if (
    !Array.isArray(input) ||
    input.length > 11
  ) {
    throw new SubmissionError(
      422,
      `${fieldName} must contain at most 11 gates.`
    );
  }

  const ids = input.map((value) => {
    /*
     * Reject booleans, decimals, null and loosely
     * convertible values such as empty strings.
     */
    if (
      !(
        typeof value === "number" ||
        (
          typeof value === "string" &&
          /^[1-9]\d*$/.test(value)
        )
      )
    ) {
      throw new SubmissionError(
        422,
        "Invalid gate ID."
      );
    }

    const id = Number(value);

    if (
      !Number.isSafeInteger(id) ||
      id <= 0
    ) {
      throw new SubmissionError(
        422,
        "Invalid gate ID."
      );
    }

    return id;
  });

  if (
    new Set(ids).size !== ids.length
  ) {
    throw new SubmissionError(
      422,
      "Duplicate gates are not allowed."
    );
  }

  if (required && ids.length === 0) {
    throw new SubmissionError(
      422,
      "Please select at least one gate."
    );
  }

  return ids;
}

function parseTrafficSetting(value) {
  if (
    value === undefined ||
    value === false ||
    value === "false"
  ) {
    return false;
  }

  if (
    value === true ||
    value === "true"
  ) {
    return true;
  }

  throw new SubmissionError(
    422,
    "Invalid Traffic approval setting."
  );
}

async function withIstTransaction(
  operation
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Applies only to this transaction.
     * Does not leak timezone changes into pooled sessions.
     */
    await client.query(
      "SET LOCAL TIME ZONE 'Asia/Kolkata'"
    );

    const result =
      await operation(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Vendor material transaction rollback failed:",
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function validateActiveGates(
  client,
  gateIds
) {
  const result = await client.query(
    `
      SELECT id
      FROM gates
      WHERE id = ANY($1::bigint[])
        AND "isActive" = TRUE
      ORDER BY id
      FOR SHARE
    `,
    [gateIds]
  );

  if (
    result.rows.length !==
    gateIds.length
  ) {
    throw new SubmissionError(
      422,
      "One or more selected gates are invalid or inactive."
    );
  }
}

const VendorMaterialLink = {

  getNextApprovalStage(
    approvedStage,
    request
  ) {
    switch (approvedStage) {
      case "PENDING_DEPARTMENT":
        if (
          request.requiresFireSafety
        ) {
          return (
            "PENDING_FIRE_SAFETY_OFFICER"
          );
        }

        return request
          .requiresTrafficApproval
          ? "PENDING_TRAFFIC_DEPARTMENT"
          : "PENDING_CISF_ASSISTANT_COMMANDANT";

      case "PENDING_FIRE_SAFETY_OFFICER":
        return request
          .requiresTrafficApproval
          ? "PENDING_TRAFFIC_DEPARTMENT"
          : "PENDING_CISF_ASSISTANT_COMMANDANT";

      case "PENDING_TRAFFIC_DEPARTMENT":
        return (
          "PENDING_CISF_ASSISTANT_COMMANDANT"
        );

      case "PENDING_CISF_ASSISTANT_COMMANDANT":
        return "COMPLETED";

      default:
        throw new SubmissionError(
          409,
          "The request is not at an approvable stage."
        );
    }
  },

  async create(client, data) {
    const result = await client.query(
      `
        INSERT INTO "vendor_material_links" (
          "referenceNo",
          "tokenHash",
          "tokenCipher",
          "createdByUserId",
          "departmentId",
          "departmentName",
          "companyName",
          "vendorEmail",
          "vendorMobile",
          "purposeOfVisitId",
          "purposeOther",
          "validFrom",
          "validTo",
          "hasWorkOrder",
          "referenceDocumentNo",
          "workOrderFilePath",
          "workOrderOriginalName",
          "remarks",
          "status",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18,
          'ACTIVE',
          NOW(),
          NOW()
        )
        RETURNING *
      `,
      [
        data.referenceNo,
        data.tokenHash,
        data.tokenCipher,
        data.createdByUserId,
        data.departmentId,
        data.departmentName,
        data.companyName,
        data.vendorEmail,
        data.vendorMobile,
        data.purposeOfVisitId,
        data.purposeOther,
        data.validFrom,
        data.validTo,
        data.hasWorkOrder,
        data.referenceDocumentNo,
        data.workOrderFilePath,
        data.workOrderOriginalName,
        data.remarks,
      ]
    );

    const link = result.rows[0];

    const uniqueGateIds = [
      ...new Set(
        (data.permittedGateIds || [])
          .map(Number)
          .filter(
            (id) =>
              Number.isSafeInteger(id) &&
              id > 0
          )
      ),
    ];

    if (uniqueGateIds.length > 0) {
      await client.query(
        `
          INSERT INTO "vendor_material_link_gates" (
            "vendorMaterialLinkId",
            "gateId",
            "createdAt",
            "updatedAt"
          )
          SELECT
            $1,
            gate_id,
            NOW(),
            NOW()
          FROM UNNEST($2::BIGINT[]) AS gate_id
        `,
        [link.id, uniqueGateIds]
      );
    }

    return link;
  },

  async getLinkMasters() {
    const [gates, purposes] =
      await Promise.all([
        pool.query(`
          SELECT
            id,
            "gateName" AS name,
            "gateCode" AS code
          FROM gates
          WHERE "isActive" = TRUE
          ORDER BY
            CAST(
              SUBSTRING(
                "gateCode"
                FROM '^GATE_([0-9]+)$'
              ) AS INTEGER
            ) ASC NULLS LAST,
            id ASC
        `),

        pool.query(`
          SELECT
            id,
            name,
            description
          FROM visit_purposes
          WHERE "isActive" = TRUE
          ORDER BY name ASC, id ASC
        `),
      ]);

    return {
      gates: gates.rows,
      purposes: purposes.rows,
    };
  },

  async createDepartmentLink({
    userId,
    departmentId,
    tokenHash,
    tokenCipher,
    payload,
    workOrder,
  }) {
    /*
    * Backward compatibility until the department
    * frontend sends the explicit selection mode.
    */
    const mode =
      payload.gateSelectionMode ??
      "DEPARTMENT";

    if (
      !["DEPARTMENT", "VENDOR"]
        .includes(mode)
    ) {
      throw new SubmissionError(
        422,
        "Invalid gate selection mode."
      );
    }

    const gateIds = parseGateIds(
      payload.permittedGateIds,
      {
        required:
          mode === "DEPARTMENT",
      }
    );

    if (
      mode === "VENDOR" &&
      gateIds.length > 0
    ) {
      throw new SubmissionError(
        422,
        "Do not select department gates when the vendor will select gates."
      );
    }

    const requiresTrafficApproval =
      parseTrafficSetting(
        payload.requiresTrafficApproval
      );

    return withIstTransaction(
      async (client) => {
        const department =
          await client.query(
            `
              SELECT
                id,
                "departmentName"
              FROM port_departments
              WHERE id = $1
                AND COALESCE(
                  "isActive",
                  TRUE
                ) = TRUE
              FOR SHARE
            `,
            [departmentId]
          );

        if (!department.rowCount) {
          throw new SubmissionError(
            422,
            "The selected department does not exist or is inactive."
          );
        }

        const purpose =
          await client.query(
            `
              SELECT id, name
              FROM visit_purposes
              WHERE id = $1
                AND "isActive" = TRUE
              FOR SHARE
            `,
            [payload.purposeOfVisitId]
          );

        if (!purpose.rowCount) {
          throw new SubmissionError(
            422,
            "The selected purpose is invalid or inactive."
          );
        }

        const selectedPurpose =
          purpose.rows[0];

        const isOtherPurpose =
          selectedPurpose.name
            .trim()
            .toLowerCase() === "others";

        if (
          isOtherPurpose &&
          !payload.purposeOther?.trim()
        ) {
          throw new SubmissionError(
            422,
            "Please specify the purpose when Others is selected."
          );
        }

        /*
        * Business dates are evaluated by PostgreSQL
        * against the current IST calendar date.
        *
        * Existing validation should also check these
        * before the model receives the payload.
        */
        if (
          typeof payload.validFrom !==
            "string" ||
          typeof payload.validTo !==
            "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(
            payload.validFrom
          ) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(
            payload.validTo
          )
        ) {
          throw new SubmissionError(
            422,
            "Provide valid dates in YYYY-MM-DD format."
          );
        }

        let dates;

        try {
          dates = await client.query(
            `
              SELECT (
                $1::date >=
                  (
                    CURRENT_TIMESTAMP
                    AT TIME ZONE
                      'Asia/Kolkata'
                  )::date
                AND $2::date >= $1::date
                AND $2::date <=
                  (
                    $1::date +
                    INTERVAL '6 months'
                  )::date
              ) AS valid
            `,
            [
              payload.validFrom,
              payload.validTo,
            ]
          );
        } catch (error) {
          if (
            ["22007", "22008"]
              .includes(error.code)
          ) {
            throw new SubmissionError(
              422,
              "Invalid link validity dates."
            );
          }

          throw error;
        }

        if (!dates.rows[0].valid) {
          throw new SubmissionError(
            422,
            "Valid from must be today or later in IST, and valid to must be within six months of valid from."
          );
        }

        if (mode === "DEPARTMENT") {
          await validateActiveGates(
            client,
            gateIds
          );
        }

        const referenceNo =
          await ReferenceNumber
            .generateVendorMaterialLinkReference(
              client
            );

        const record =
          await this.create(client, {
            referenceNo,
            tokenHash,
            tokenCipher,
            createdByUserId: userId,
            departmentId:
              department.rows[0].id,
            departmentName:
              department.rows[0]
                .departmentName,
            companyName:
              payload.companyName,
            vendorEmail:
              payload.vendorEmail,
            vendorMobile:
              payload.vendorMobile,
            purposeOfVisitId:
              selectedPurpose.id,
            purposeOther:
              isOtherPurpose
                ? payload.purposeOther.trim()
                : null,
            permittedGateIds: gateIds,
            validFrom: payload.validFrom,
            validTo: payload.validTo,
            hasWorkOrder:
              Boolean(workOrder),
            referenceDocumentNo:
              payload.referenceDocumentNo ||
              null,
            workOrderFilePath:
              workOrder?.path || null,
            workOrderOriginalName:
              workOrder?.originalname ||
              null,
            remarks:
              payload.remarks || null,
          });

        const updated =
          await client.query(
            `
              UPDATE vendor_material_links
              SET
                "gateSelectionMode" = $2,
                "requiresTrafficApproval" = $3
              WHERE id = $1
              RETURNING
                *,
                "validFrom"::text
                  AS "validFrom",
                "validTo"::text
                  AS "validTo"
            `,
            [
              record.id,
              mode,
              requiresTrafficApproval,
            ]
          );

        return updated.rows[0];
      }
    );
  },

  async getPublicApplicationDetails(
    tokenHash
  ) {
    const result = await pool.query(
      `
        SELECT
          link.*,
          link."validFrom"::text
            AS "validFrom",
          link."validTo"::text
            AS "validTo",

          (
            link."validFrom" <=
              (
                CURRENT_TIMESTAMP
                AT TIME ZONE 'Asia/Kolkata'
              )::date
            AND link."validTo" >=
              (
                CURRENT_TIMESTAMP
                AT TIME ZONE 'Asia/Kolkata'
              )::date
          ) AS "withinValidity",

          CASE
            WHEN LOWER(
              TRIM(COALESCE(purpose.name, ''))
            ) = 'others'
            THEN COALESCE(
              NULLIF(
                TRIM(link."purposeOther"),
                ''
              ),
              purpose.name
            )
            ELSE purpose.name
          END AS purpose,

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', gate.id,
                  'name', gate."gateName",
                  'code', gate."gateCode"
                )
                ORDER BY
                  CAST(
                    SUBSTRING(
                      gate."gateCode"
                      FROM '^GATE_([0-9]+)$'
                    ) AS INTEGER
                  ) ASC NULLS LAST,
                  gate.id
              )
              FROM vendor_material_link_gates
                AS link_gate
              JOIN gates AS gate
                ON gate.id =
                  link_gate."gateId"
              WHERE
                link_gate."vendorMaterialLinkId"
                  = link.id
            ),
            '[]'::jsonb
          ) AS "permittedGates",

          CASE
            WHEN link."gateSelectionMode"
              = 'VENDOR'
            THEN COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', gate.id,
                    'name', gate."gateName",
                    'code', gate."gateCode"
                  )
                  ORDER BY
                    CAST(
                      SUBSTRING(
                        gate."gateCode"
                        FROM '^GATE_([0-9]+)$'
                      ) AS INTEGER
                    ) ASC NULLS LAST,
                    gate.id
                )
                FROM gates AS gate
                WHERE gate."isActive" = TRUE
              ),
              '[]'::jsonb
            )
            ELSE '[]'::jsonb
          END AS "availableGates"

        FROM vendor_material_links AS link
        LEFT JOIN visit_purposes AS purpose
          ON purpose.id =
            link."purposeOfVisitId"
        WHERE link."tokenHash" = $1
          AND link.status = 'ACTIVE'
          AND link."validTo" >=
            (
              CURRENT_TIMESTAMP
              AT TIME ZONE 'Asia/Kolkata'
            )::date
      `,
      [tokenHash]
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    const {
      availableGates,
      ...link
    } = row;

    return {
      link,
      availableGates,
    };
  },

  async getOwnedById(id, departmentId) {
    const result = await pool.query(
      `
        SELECT
          vml.*,
          COALESCE(
            JSONB_AGG(
              JSONB_BUILD_OBJECT(
                'id', vmlg."gateId",
                'name', g."gateName"
              )
            ) FILTER (
              WHERE vmlg.id IS NOT NULL
            ),
            '[]'::jsonb
          ) AS "permittedGates"
        FROM "vendor_material_links" vml
        LEFT JOIN "vendor_material_link_gates" vmlg
          ON vmlg."vendorMaterialLinkId" = vml.id
        LEFT JOIN gates g
          ON g.id = vmlg."gateId"
        WHERE vml.id = $1
          AND vml."departmentId" = $2
        GROUP BY vml.id
      `,
      [id, departmentId]
    );

    const row = result.rows[0];

    if (!row) return null;

    row.status = getEffectiveStatus(row);

    return row;
  },

  async getByTokenHash(tokenHash) {
    const result = await pool.query(
      `
        SELECT
          vml.*,

          CASE
            WHEN LOWER(
              TRIM(
                COALESCE(
                  vp.name,
                  ''
                )
              )
            ) = 'others'
              THEN COALESCE(
                NULLIF(
                  TRIM(
                    vml."purposeOther"
                  ),
                  ''
                ),
                vp.name
              )
            ELSE vp.name
          END AS purpose,

          COALESCE(
            JSONB_AGG(
              JSONB_BUILD_OBJECT(
                'id',
                vmlg."gateId",
                'name',
                g."gateName"
              )
              ORDER BY g."gateName"
            ) FILTER (
              WHERE vmlg.id IS NOT NULL
            ),
            '[]'::jsonb
          ) AS "permittedGates"

        FROM "vendor_material_links" vml

        LEFT JOIN visit_purposes vp
          ON vp.id =
            vml."purposeOfVisitId"

        LEFT JOIN "vendor_material_link_gates" vmlg
          ON vmlg."vendorMaterialLinkId" =
            vml.id

        LEFT JOIN gates g
          ON g.id =
            vmlg."gateId"

        WHERE vml."tokenHash" = $1

        GROUP BY
          vml.id,
          vp.id,
          vp.name
      `,
      [tokenHash]
    );

    const row =
      result.rows[0];

    if (!row) {
      return null;
    }

    row.status =
      getEffectiveStatus(row);

    return row;
  },

  async list({
    departmentId,
    createdByUserId,
    page,
    limit,
    offset,
    search,
    status,
    sortBy,
    sortOrder,
  }) {
    const values = [departmentId];
    const where = [
      `vml."departmentId" = $1`,
    ];

    let parameterIndex = 2;

    if (createdByUserId) {
      where.push(
        `vml."createdByUserId" = $${parameterIndex}`
      );

      values.push(createdByUserId);
      parameterIndex += 1;
    }

    if (search) {
      where.push(
        `(
          vml."referenceNo" ILIKE $${parameterIndex}
          OR vml."companyName" ILIKE $${parameterIndex}
          OR vml."vendorEmail" ILIKE $${parameterIndex}
          OR vml."vendorMobile" ILIKE $${parameterIndex}
        )`
      );

      values.push(`%${search}%`);
      parameterIndex += 1;
    }

    const effectiveStatusSql = `
      CASE
        WHEN vml.status IN (
          'REVOKED',
          'DISABLED',
          'EXPIRED'
        )
          THEN vml.status
        WHEN vml."validTo" <
          (
            CURRENT_TIMESTAMP
            AT TIME ZONE 'Asia/Kolkata'
          )::DATE
          THEN 'EXPIRED'
        ELSE 'ACTIVE'
      END
    `;

    if (
      status &&
      ["ACTIVE", "EXPIRED", "REVOKED", "DISABLED"].includes(status)
    ) {
      where.push(
        `${effectiveStatusSql} = $${parameterIndex}`
      );

      values.push(status);
      parameterIndex += 1;
    }

    const whereSql =
      `WHERE ${where.join(" AND ")}`;

    const countResult = await pool.query(
      `
        SELECT COUNT(*)::INTEGER AS total
        FROM "vendor_material_links" vml
        ${whereSql}
      `,
      values
    );

    const total =
      Number(countResult.rows[0]?.total || 0);

    if (total === 0) {
      return {
        rows: [],
        total: 0,
      };
    }

    const safeSortColumn =
      ALLOWED_SORT_COLUMNS[sortBy] ||
      ALLOWED_SORT_COLUMNS.createdAt;

    const safeSortOrder =
      sortOrder === "ASC" ? "ASC" : "DESC";

    const dataValues = [
      ...values,
      limit,
      offset,
    ];

    const limitPosition = parameterIndex;
    const offsetPosition = parameterIndex + 1;

    const dataResult = await pool.query(
      `
        SELECT
          vml.id,
          vml."referenceNo",
          vml."tokenCipher",
          vml."createdByUserId",
          vml."departmentId",
          vml."departmentName",
          vml."companyName",
          vml."vendorEmail",
          vml."vendorMobile",
          CASE
            WHEN LOWER(
              TRIM(COALESCE(vp.name, ''))
            ) = 'others'
              THEN COALESCE(
                NULLIF(
                  TRIM(vml."purposeOther"),
                  ''
                ),
                vp.name
              )
            ELSE vp.name
          END AS purpose,
          vml."validFrom",
          vml."validTo",
          vml."hasWorkOrder",
          vml."referenceDocumentNo",
          vml."workOrderOriginalName",
          vml.remarks,
          ${effectiveStatusSql} AS status,
          vml."lastEmailSentAt",
          vml."createdAt",
          vml."gateSelectionMode",
          vml."requiresTrafficApproval",
          u."userName" AS "createdByUserName",

          /*
            COALESCE(
              (
                SELECT COUNT(*)::INTEGER
                FROM "vendor_material_requests" vmr
                WHERE vmr."vendorMaterialLinkId" = vml.id
              ),
              0
            ) AS "requestCount",
          */
          
          0::INTEGER AS "requestCount",

          COALESCE(
            (
              SELECT JSONB_AGG(
                JSONB_BUILD_OBJECT(
                  'id', vmlg."gateId",
                  'name', g."gateName"
                )
                ORDER BY g."gateName"
              )
              FROM "vendor_material_link_gates" vmlg
              LEFT JOIN gates g
                ON g.id = vmlg."gateId"
              WHERE vmlg."vendorMaterialLinkId" = vml.id
            ),
            '[]'::jsonb
          ) AS "permittedGates"

        FROM "vendor_material_links" vml

        LEFT JOIN users u
          ON u.id = vml."createdByUserId"

        LEFT JOIN visit_purposes vp
          ON vp.id = vml."purposeOfVisitId"

        ${whereSql}

        ORDER BY ${safeSortColumn} ${safeSortOrder}

        LIMIT $${limitPosition}
        OFFSET $${offsetPosition}
      `,
      dataValues
    );

    return {
      rows: dataResult.rows,
      total,
    };
  },

  async markEmailSent(id) {
    const result = await pool.query(
      `
        UPDATE "vendor_material_links"
        SET
          "lastEmailSentAt" = NOW(),
          "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id]
    );

    return result.rows[0] || null;
  },

  async revoke({
    id,
    departmentId,
    revokedByUserId,
    reason,
  }) {
    const result = await pool.query(
      `
        UPDATE "vendor_material_links"
        SET
          status = 'REVOKED',
          "revokedAt" = NOW(),
          "revokedByUserId" = $3,
          "revokeReason" = $4,
          "updatedAt" = NOW()
        WHERE id = $1
          AND "departmentId" = $2
          AND status = 'ACTIVE'
          AND "validTo" >=
            (
              CURRENT_TIMESTAMP
              AT TIME ZONE 'Asia/Kolkata'
            )::DATE
        RETURNING *
      `,
      [
        id,
        departmentId,
        revokedByUserId,
        reason,
      ]
    );

    return result.rows[0] || null;
  },

  async gatesExist(gateIds, client = pool) {
    const uniqueGateIds = [
      ...new Set(
        (gateIds || []).map(Number)
      ),
    ];

    if (uniqueGateIds.length === 0) {
      return true;
    }

    const result = await client.query(
      `
        SELECT id
        FROM gates
        WHERE id = ANY($1::BIGINT[])
          AND "isActive" = TRUE
      `,
      [uniqueGateIds]
    );

    return (
      result.rows.length ===
      uniqueGateIds.length
    );
  },

  async getActiveDepartmentById(
    departmentId,
    client = pool
  ) {
    const result = await client.query(
      `
        SELECT
          id,
          "departmentName"
        FROM port_departments
        WHERE id = $1
          AND COALESCE("isActive", TRUE) = TRUE
        LIMIT 1
      `,
      [departmentId]
    );

    return result.rows[0] || null;
  },

  async getActivePurposeById(
    purposeOfVisitId,
    client = pool
  ) {
    const result = await client.query(
      `
        SELECT
          id,
          name
        FROM visit_purposes
        WHERE id = $1
          AND "isActive" = TRUE
        LIMIT 1
      `,
      [purposeOfVisitId]
    );

    return result.rows[0] || null;
  },

  async createVendorMaterialRequest(
    tokenHash,
    payload
  ) {
    /*
    * Your existing request validation remains responsible
    * for validating person, vehicle and material fields.
    *
    * Gate requirements depend on the stored link, so
    * they are enforced here inside the transaction.
    */
    return withIstTransaction(
      async (client) => {
        const linkResult =
          await client.query(
            `
              SELECT
                id,
                status,
                "gateSelectionMode",
                "requiresTrafficApproval",
                "vendorRequestLimit",
                "totalVendorSubmissions",

                (
                  "validFrom" <=
                    (
                      CURRENT_TIMESTAMP
                      AT TIME ZONE
                        'Asia/Kolkata'
                    )::date
                  AND "validTo" >=
                    (
                      CURRENT_TIMESTAMP
                      AT TIME ZONE
                        'Asia/Kolkata'
                    )::date
                ) AS "withinValidity"

              FROM vendor_material_links
              WHERE "tokenHash" = $1
              FOR UPDATE
            `,
            [tokenHash]
          );

        const link =
          linkResult.rows[0];

        if (
          !link ||
          link.status !== "ACTIVE" ||
          !link.withinValidity
        ) {
          throw new SubmissionError(
            410,
            "This application link is unavailable."
          );
        }

        if (
          Number(
            link.totalVendorSubmissions
          ) >=
          Number(link.vendorRequestLimit)
        ) {
          throw new SubmissionError(
            409,
            "The submission limit for this link has been reached."
          );
        }

        let selectedGateIds;
        let gateActorType;

        if (
          link.gateSelectionMode ===
          "DEPARTMENT"
        ) {
          /*
          * Reject attempts to supply different gates.
          * Sending the exact locked gate list is also
          * supported for frontend compatibility.
          */
          const storedGates =
            await client.query(
              `
                SELECT "gateId"
                FROM vendor_material_link_gates
                WHERE
                  "vendorMaterialLinkId" = $1
                ORDER BY "gateId"
                FOR SHARE
              `,
              [link.id]
            );

          selectedGateIds =
            storedGates.rows.map(
              (row) => Number(row.gateId)
            );

          if (
            selectedGateIds.length === 0
          ) {
            throw new SubmissionError(
              409,
              "The department gates are not configured. Please contact the department."
            );
          }

          if (
            payload.permittedGateIds !==
            undefined
          ) {
            const submittedGateIds =
              parseGateIds(
                payload.permittedGateIds
              );

            const storedSet =
              new Set(selectedGateIds);

            if (
              submittedGateIds.length !==
                selectedGateIds.length ||
              submittedGateIds.some(
                (id) => !storedSet.has(id)
              )
            ) {
              throw new SubmissionError(
                422,
                "The gates selected by the department cannot be changed."
              );
            }
          }

          gateActorType = "SYSTEM";
        } else if (
          link.gateSelectionMode ===
          "VENDOR"
        ) {
          selectedGateIds =
            parseGateIds(
              payload.permittedGateIds,
              { required: true }
            );

          gateActorType = "VENDOR";
        } else {
          throw new SubmissionError(
            409,
            "The application link gate configuration is invalid."
          );
        }

        /*
        * Recheck both vendor-selected and inherited gates.
        * A gate may have been deactivated since link creation.
        */
        await validateActiveGates(
          client,
          selectedGateIds
        );

        const selectedUnitIds = [
          ...new Set(
            payload.items
              .map((item) => item.unitId)
              .filter(
                (id) =>
                  id !== null &&
                  id !== undefined
              )
          ),
        ];

        if (selectedUnitIds.length > 0) {
          const unitResult =
            await client.query(
              `
                SELECT id
                FROM units
                WHERE id =
                  ANY($1::bigint[])
                ORDER BY id
                FOR SHARE
              `,
              [selectedUnitIds]
            );

          const existingIds = new Set(
            unitResult.rows.map(
              (row) => String(row.id)
            )
          );

          if (
            selectedUnitIds.some(
              (id) =>
                !existingIds.has(String(id))
            )
          ) {
            throw new SubmissionError(
              422,
              "One or more selected units are invalid."
            );
          }
        }

        const referenceNumber =
          await ReferenceNumber
            .generateVendorMaterialRequestReference(
              client
            );

        const requiresFireSafety =
          payload.items.some(
            (item) =>
              item.isHazardous === true
          );

        /*
        * Traffic comes exclusively from the stored link.
        * No vendor-supplied Traffic value is used.
        */
        const requestResult =
          await client.query(
            `
              INSERT INTO vendor_material_requests (
                "referenceNumber",
                "vendorMaterialLinkId",
                "requestSource",
                "requestType",
                "vehicleNumber",
                "personName",
                "aadhaarNumber",
                "requiresFireSafety",
                "requiresTrafficApproval",
                "currentStage",
                status,
                "isEnabled",
                "currentRevisionNumber",
                "createdByUserId",
                "submittedAt",
                "vendorRemarks",
                "reSubmissionCount",
                "createdAt",
                "updatedAt"
              )
              VALUES (
                $1, $2,
                'VENDOR', 'REGULAR',
                $3, $4, $5,
                $6, $7,
                'PENDING_DEPARTMENT',
                'SUBMITTED',
                TRUE, 1, NULL,
                NOW(), $8, 0,
                NOW(), NOW()
              )
              RETURNING
                id,
                "referenceNumber"
            `,
            [
              referenceNumber,
              link.id,
              payload.vehicleNumber ||
                null,
              payload.personName || null,
              payload.aadhaarNumber ||
                null,
              requiresFireSafety,
              link.requiresTrafficApproval,
              payload.vendorRemarks ||
                null,
            ]
          );

        const request =
          requestResult.rows[0];

        /*
        * Department mode uses only stored link gate IDs.
        * Vendor mode uses the validated submitted IDs.
        *
        * Both are saved in the same request-gate table.
        */
        await client.query(
          `
            INSERT INTO vendor_material_request_gates (
              "requestId",
              "gateId",
              "isActive",
              "addedByUserId",
              "addedByActorType",
              "createdAt",
              "updatedAt"
            )
            SELECT
              $1,
              gate_id,
              TRUE,
              NULL,
              $3,
              NOW(),
              NOW()
            FROM UNNEST(
              $2::bigint[]
            ) AS selected_gate(gate_id)
          `,
          [
            request.id,
            selectedGateIds,
            gateActorType,
          ]
        );

        for (const item of payload.items) {
          const hasQuantity =
            item.requestedQty !== null &&
            item.requestedQty !==
              undefined &&
            item.requestedQty !== "";

          /*
          * Preserve your existing quantity behavior.
          * UNSPECIFIED is only valid for non-returnable
          * materials.
          */
          if (
            !hasQuantity &&
            item.materialType !==
              "NON_RETURNABLE"
          ) {
            throw new SubmissionError(
              422,
              "Quantity is mandatory for returnable materials."
            );
          }

          const quantityMode =
            hasQuantity
              ? "LIMITED"
              : "UNSPECIFIED";

          const unitId =
            hasQuantity
              ? item.unitId
              : null;

          const masterItemId =
            await findOrCreateMasterItem(
              client,
              {
                linkId: link.id,
                name: item.name,
                materialType:
                  item.materialType,
                unitId,
              }
            );

          await client.query(
            `
              INSERT INTO vendor_material_list (
                "vendorMaterialRequestId",
                "vendorMasterItemId",
                "quantityMode",
                "requestedQty",
                "departmentApprovedQty",
                "unitId",
                description,
                "isHazardous",
                "departmentDecision",
                "departmentRemarks",
                "revisionNumber",
                "isActive",
                "createdAt",
                "updatedAt"
              )
              VALUES (
                $1, $2, $3, $4,
                NULL, $5, $6, $7,
                'PENDING', NULL, 1,
                TRUE, NOW(), NOW()
              )
            `,
            [
              request.id,
              masterItemId,
              quantityMode,
              hasQuantity
                ? item.requestedQty
                : null,
              unitId,
              item.description || null,
              item.isHazardous,
            ]
          );
        }

        const updated =
          await client.query(
            `
              UPDATE vendor_material_links
              SET
                "totalVendorSubmissions" =
                  "totalVendorSubmissions" + 1,
                "updatedAt" = NOW()
              WHERE id = $1
                AND status = 'ACTIVE'
                AND "totalVendorSubmissions" <
                  "vendorRequestLimit"
                AND "validFrom" <=
                  (
                    CURRENT_TIMESTAMP
                    AT TIME ZONE
                      'Asia/Kolkata'
                  )::date
                AND "validTo" >=
                  (
                    CURRENT_TIMESTAMP
                    AT TIME ZONE
                      'Asia/Kolkata'
                  )::date
              RETURNING id
            `,
            [link.id]
          );

        if (!updated.rowCount) {
          throw new SubmissionError(
            409,
            "The application link is no longer available for submission."
          );
        }

        return {
          id: request.id,
          referenceNumber:
            request.referenceNumber,
        };
      }
    );
  },

  async listPublicSubmittedRequests({
    tokenHash,
    page,
    limit,
    search,
    status,
  }) {
    const client = await pool.connect();

    try {
      await client.query(
        "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
      );

      const linkResult = await client.query(
        `
          SELECT id
          FROM vendor_material_links
          WHERE "tokenHash" = $1
            AND status = 'ACTIVE'
            AND "validFrom" <=
                (NOW() AT TIME ZONE 'Asia/Kolkata')::date
            AND "validTo" >=
                (NOW() AT TIME ZONE 'Asia/Kolkata')::date
        `,
        [tokenHash]
      );

      const linkId = linkResult.rows[0]?.id;

      if (!linkId) {
        await client.query("COMMIT");
        return null;
      }

      const conditions = [
        `vmr."vendorMaterialLinkId" = $1`,
        `vmr."requestSource" = 'VENDOR'`,
        `vmr.status IN (
          'SUBMITTED',
          'REVERTED',
          'APPROVED',
          'REJECTED'
        )`,
      ];

      const values = [linkId];

      if (search) {
        // Treat %, _, and \ in user input as literal characters.
        const escapedSearch = search.replace(
          /[\\%_]/g,
          "\\$&"
        );

        values.push(`%${escapedSearch}%`);
        const searchPosition = values.length;

        conditions.push(`
          (
            vmr."referenceNumber"
              ILIKE $${searchPosition} ESCAPE chr(92)

            OR EXISTS (
              SELECT 1
              FROM vendor_material_list vml_search

              JOIN vendor_master_items vmi_search
                ON vmi_search.id =
                  vml_search."vendorMasterItemId"
              AND vmi_search."vendorMaterialLinkId" =
                  vmr."vendorMaterialLinkId"

              WHERE vml_search."vendorMaterialRequestId" =
                    vmr.id
                AND vml_search."isActive" = TRUE
                AND vml_search."revisionNumber" =
                    vmr."currentRevisionNumber"
                AND vmi_search.name
                    ILIKE $${searchPosition} ESCAPE chr(92)
            )
          )
        `);
      }

      // The status counts follow the search, but do not follow the
      // selected status filter.
      const baseWhere = conditions.join(" AND ");

      const countsResult = await client.query(
        `
          SELECT
            COUNT(*)::int AS total,

            COUNT(*) FILTER (
              WHERE vmr.status = 'SUBMITTED'
            )::int AS pending,

            COUNT(*) FILTER (
              WHERE vmr.status = 'APPROVED'
            )::int AS approved,

            COUNT(*) FILTER (
              WHERE vmr.status = 'REVERTED'
            )::int AS reverted,

            COUNT(*) FILTER (
              WHERE vmr.status = 'REJECTED'
            )::int AS rejected

          FROM vendor_material_requests vmr
          WHERE ${baseWhere}
        `,
        values
      );

      const counts = countsResult.rows[0];

      if (status !== "ALL") {
        const databaseStatus =
          status === "PENDING" ? "SUBMITTED" : status;

        values.push(databaseStatus);
        conditions.push(`vmr.status = $${values.length}`);
      }

      const filteredWhere = conditions.join(" AND ");

      const totalResult = await client.query(
        `
          SELECT COUNT(*)::int AS total
          FROM vendor_material_requests vmr
          WHERE ${filteredWhere}
        `,
        values
      );

      const total = totalResult.rows[0].total;
      const offset = (page - 1) * limit;

      values.push(limit);
      const limitPosition = values.length;

      values.push(offset);
      const offsetPosition = values.length;

      const requestsResult = await client.query(
        `
          SELECT
            vmr.id,
            vmr."referenceNumber",
            vmr."requestType",
            vmr."vehicleNumber",
            vmr."personName",
            CASE
              WHEN vmr."aadhaarNumber" ~ '^[0-9]{12}$'
              THEN 'XXXX XXXX ' || RIGHT(vmr."aadhaarNumber", 4)
              ELSE NULL
            END AS "aadhaarMasked",
            vmr."vendorRemarks",
            vmr."submittedAt",
            vmr."approvedAt",
            vmr."rejectedAt",
            vmr."updatedAt",
            vmr.status,

            COALESCE(
              items.items,
              '[]'::jsonb
            ) AS items

          FROM vendor_material_requests vmr

          LEFT JOIN LATERAL (
            SELECT
              jsonb_agg(
                jsonb_build_object(
                  'id', vml.id,
                  'name', vmi.name,
                  'materialType', vmi."materialType",
                  'description', vml.description,
                  'isHazardous', vml."isHazardous",
                  'quantityMode', vml."quantityMode",
                  'requestedQty', vml."requestedQty",
                  'unitId', vml."unitId",
                  'unitName', u."unitName",

                  'approvedQty',
                    CASE
                      WHEN vmr.status = 'APPROVED'
                      THEN vml."departmentApprovedQty"
                      ELSE NULL
                    END
                )
                ORDER BY vml.id
              ) AS items

            FROM vendor_material_list vml

            JOIN vendor_master_items vmi
              ON vmi.id = vml."vendorMasterItemId"
            AND vmi."vendorMaterialLinkId" =
                vmr."vendorMaterialLinkId"

            LEFT JOIN units u
              ON u.id = vml."unitId"

            WHERE vml."vendorMaterialRequestId" = vmr.id
              AND vml."isActive" = TRUE
              AND vml."revisionNumber" =
                  vmr."currentRevisionNumber"
          ) items ON TRUE

          WHERE ${filteredWhere}

          ORDER BY
            vmr."submittedAt" DESC NULLS LAST,
            vmr.id DESC

          LIMIT $${limitPosition}
          OFFSET $${offsetPosition}
        `,
        values
      );

      await client.query("COMMIT");

      const rows = requestsResult.rows.map((row) => ({
        id: row.id,
        referenceNumber: row.referenceNumber,
        requestType: row.requestType,

        status:
          row.status === "SUBMITTED"
            ? "PENDING"
            : row.status,

        vehicleNumber: row.vehicleNumber,
        personName: row.personName,
        aadhaarMasked: row.aadhaarMasked,
        vendorRemarks: row.vendorRemarks,
        submittedAt: row.submittedAt,

        approvedAt:
          row.status === "APPROVED"
            ? row.approvedAt
            : null,

        rejectedAt:
          row.status === "REJECTED"
            ? row.rejectedAt
            : null,

        updatedAt: row.updatedAt,
        items: row.items,
      }));

      return {
        rows,
        total,
        counts,
      };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Vendor request list rollback error:",
          rollbackError
        );
      }

      throw error;
    } finally {
      client.release();
    }
  },
};

VendorMaterialLink.SubmissionError =
  SubmissionError;

module.exports = VendorMaterialLink;