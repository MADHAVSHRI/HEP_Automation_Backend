const { pool } = require("../dbconfig/db");
const bcrypt = require("bcrypt");

const Agent = {
  async findDuplicate(email, mobileNo, panNumber, gstinNumber) {
    const query = `
      SELECT * FROM "Agents"
      WHERE email=$1 OR "mobileNo"=$2 OR "panNumber"=$3 OR "gstinNumber"=$4
      LIMIT 1
    `;
    const values = [email, mobileNo, panNumber, gstinNumber];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  //   async generateReferenceNumber() {

  //   const result = await pool.query(
  //     `SELECT COUNT(*) FROM "Agents"`
  //   );

  //   const next = parseInt(result.rows[0].count) + 1;

  //   const padded = String(next).padStart(5,"0");

  //   return `CHPT${padded}`;
  // },

  async generateReferenceNumber() {
    const result = await pool.query(`SELECT nextval('agent_reference_seq')`);

    const next = result.rows[0].nextval;

    const padded = String(next).padStart(5, "0");

    return `CHPT${padded}`;
  },

  async updateEmailStatus(agentId) {
    const query = `
      UPDATE "Agents"
      SET "isRefNoSentByEmail" = true
      WHERE id = $1
    `;

    await pool.query(query, [agentId]);
  },

  async create(agentData) {
    const referenceNumber = await Agent.generateReferenceNumber();
    const createdAt = new Date().toISOString(); // Set the current timestamp
    const updatedAt = createdAt; // Set updatedAt to the same value as createdAt

    // Log the data to ensure the fields are being set
    console.log("Creating agent with data:", agentData);
    console.log("createdAt:", createdAt);
    console.log("updatedAt:", updatedAt);

    const query = `
      INSERT INTO "Agents"(
        "userTypeId",
        "userTypeName",
        "entityName",
        "mobileNo",
        "email",
        "workOrder",
        "licenseNumber",
        "licenseValidityDate",
        "requisitionLetter",
        "addressLine",
        "city",
        "state",
        "pincode",
        "country",
        "gstinNumber",
        "gstinDoc",
        "panNumber",
        "panDoc",
        "tanNumber",
        "tanDoc",
        "remark",
        "referenceNumber",
        "title",
        "firstName",
        "lastName",
        "contactMobile",
        "contactEmail",
        "termsAccepted",
        "createdAt",
        "updatedAt"  -- Add updatedAt here
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12,
        $13, $14,
        $15, $16,
        $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27, $28, $29, $30  -- Update to include the new placeholder for updatedAt
      )
      RETURNING *
    `;

    const values = [
      agentData.userTypeId,
      agentData.userTypeName,
      agentData.entityName,
      agentData.mobileNo,
      agentData.email,
      agentData.workOrder,
      agentData.licenseNumber,
      agentData.licenseValidityDate,
      agentData.requisitionLetter,
      agentData.addressLine,
      agentData.city,
      agentData.state,
      agentData.pincode,
      agentData.country,
      agentData.gstinNumber,
      agentData.gstinDoc,
      agentData.panNumber,
      agentData.panDoc,
      agentData.tanNumber,
      agentData.tanDoc,
      agentData.remark,
      referenceNumber,
      agentData.title,
      agentData.firstName,
      agentData.lastName,
      agentData.contactMobile,
      agentData.contactEmail,
      agentData.termsAccepted,
      createdAt, // Include createdAt here
      updatedAt, // Include updatedAt here
    ];

    try {
      const result = await pool.query(query, values);
      console.log("Agent created successfully:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error("Error creating agent:", error);
      throw error; // Re-throw the error so it can be handled elsewhere
    }
  },

  async getAllRegisteredAgents(pagination = {}) {
    const {
      page = 1,
      limit = 20,
      offset = 0,
      search = "",
      isApproved,
      status,
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
        console.error("Error looking up user for agent processedByMe filter:", err);
      }
    }

    const searchWhere = [];
    const searchParams = [];
    let i = 1;

    if (search) {
      const searchParam = `%${search}%`;
      searchWhere.push(`(
        "entityName" ILIKE $${i}
        OR "mobileNo" ILIKE $${i}
        OR "email" ILIKE $${i}
        OR "referenceNumber" ILIKE $${i}
        OR "panNumber" ILIKE $${i}
        OR "loginId" ILIKE $${i}
      )`);
      searchParams.push(searchParam);
      i++;
    }

    const searchWhereSql = searchWhere.length ? `WHERE ${searchWhere.join(" AND ")}` : "";

    // ─── Query 1: Total and status counts (filtered by search query only) ───
    const countQuery = `
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN ("isApproved" = true OR status = 'approved') ${processedByMe && approvedByUserName ? `AND "approvedBy" = $${searchParams.length + 1}` : ""} THEN 1 END) AS approved,
        COUNT(CASE WHEN status = 'rejected' ${processedByMe && approvedByUserName ? `AND "approvedBy" = $${searchParams.length + 1}` : ""} THEN 1 END) AS rejected,
        COUNT(CASE WHEN status = 'pending' OR status IS NULL OR (status != 'approved' AND status != 'rejected' AND "isApproved" = false) THEN 1 END) AS pending
      FROM "Agents"
      ${searchWhereSql}
    `;
    const countParamsForQuery = [...searchParams];
    if (processedByMe && approvedByUserName) {
      countParamsForQuery.push(approvedByUserName);
    }
    const countRes = await pool.query(countQuery, countParamsForQuery);
    const counts = {
      total: parseInt(countRes.rows[0]?.total || 0),
      approved: parseInt(countRes.rows[0]?.approved || 0),
      rejected: parseInt(countRes.rows[0]?.rejected || 0),
      pending: parseInt(countRes.rows[0]?.pending || 0),
    };

    if (counts.total === 0) {
      return { data: [], counts };
    }

    // ─── Query 2: Paginated IDs with list-specific filters ───
    const listWhere = [...searchWhere];
    const listParams = [...searchParams];
    let j = i;

    if (isApproved !== undefined && isApproved !== null && isApproved !== "") {
      listWhere.push(`"isApproved" = $${j++}`);
      listParams.push(isApproved === "true");
    }

    if (status === "pending") {
      listWhere.push(`("status" = 'pending' OR "status" IS NULL OR ("status" != 'approved' AND "status" != 'rejected' AND "isApproved" = false))`);
    } else if (status === "processed") {
      listWhere.push(`("status" IN ('approved', 'rejected', 'reverted') OR "isApproved" = true)`);
      if (processedByMe && approvedByUserName) {
        listWhere.push(`"approvedBy" = $${j++}`);
        listParams.push(approvedByUserName);
      }
    } else if (status) {
      listWhere.push(`"status" = $${j++}`);
      listParams.push(status);
      if (processedByMe && approvedByUserName && (status === "approved" || status === "rejected" || status === "reverted")) {
        listWhere.push(`"approvedBy" = $${j++}`);
        listParams.push(approvedByUserName);
      }
    }

    const listWhereSql = listWhere.length ? `WHERE ${listWhere.join(" AND ")}` : "";

    const idParams = [...listParams, limit, offset];
    const idQuery = `
      SELECT id
      FROM "Agents"
      ${listWhereSql}
      ORDER BY "createdAt" DESC
      LIMIT $${j} OFFSET $${j + 1}
    `;
    const idRes = await pool.query(idQuery, idParams);
    const agentIds = idRes.rows.map((r) => r.id);

    if (agentIds.length === 0) {
      return { data: [], counts };
    }

    // ─── Query 3: Detail Hydration ───
    const placeholders = agentIds.map((_, idx) => `$${idx + 1}`).join(",");
    const detailQuery = `
      SELECT
        id,
        "userTypeName",
        "entityName",
        "mobileNo",
        "email",
        "city",
        "state",
        "gstinNumber",
        "panNumber",
        "referenceNumber",
        "loginId",
        "role",
        "status",
        "isApproved",
        "approvedBy",
        "isRefNoSentByEmail",
        "isCredentialSentByEmail",
        "createdAt",
        "updatedAt"
      FROM "Agents"
      WHERE id IN (${placeholders})
      ORDER BY "createdAt" DESC
    `;
    const detailRes = await pool.query(detailQuery, agentIds);

    return { data: detailRes.rows, counts };
  },

  async updateEmailStatusByReference(referenceNumber) {
    const query = `
    UPDATE "Agents"
    SET "isRefNoSentByEmail" = true
    WHERE "referenceNumber" = $1
  `;

    await pool.query(query, [referenceNumber]);
  },

  async approveAgent(agentId, loginId, password, approvedByUserId) {
    let approvedBy = null;
    if (approvedByUserId) {
      try {
        const userRes = await pool.query('SELECT "userName" FROM "users" WHERE id = $1', [approvedByUserId]);
        if (userRes.rows.length > 0) {
          approvedBy = userRes.rows[0].userName;
        }
      } catch (err) {
        console.error("Error fetching agent approver username:", err);
      }
    }
    const query = `
      UPDATE "Agents"
      SET
        "isApproved" = true,
        "status" = 'approved',
        "loginId" = $2,
        "password" = $3,
        "approvedBy" = $4
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [agentId, loginId, password, approvedBy]);

    return result.rows[0];
  },

  async rejectAgent(agentId, reason, approvedByUserId) {
    let approvedBy = null;
    if (approvedByUserId) {
      try {
        const userRes = await pool.query('SELECT "userName" FROM "users" WHERE id = $1', [approvedByUserId]);
        if (userRes.rows.length > 0) {
          approvedBy = userRes.rows[0].userName;
        }
      } catch (err) {
        console.error("Error fetching agent rejector username:", err);
      }
    }
    const query = `
      UPDATE "Agents"
      SET
        "status"='rejected',
        "rejectedReason"=$2,
        "approvedBy"=$3
      WHERE id=$1
      RETURNING *
    `;

    const result = await pool.query(query, [agentId, reason, approvedBy]);

    return result.rows[0];
  },

  async updateCredentialEmailStatus(agentId) {
    const query = `
      UPDATE "Agents"
      SET "isCredentialSentByEmail" = true
      WHERE id = $1
    `;

    await pool.query(query, [agentId]);
  },

  async getAgentById(agentId) {
    const query = `
    SELECT
      id,
      "userTypeName",
      "entityName",
      "firstName",
      "lastName",
      "email",
      "mobileNo",
      "city",
      "state",
      "country",
      "addressLine",
      "pincode",
      "gstinNumber",
      "referenceNumber",
      "loginId",
      "role",
      "status",
      "createdAt"
    FROM "Agents"
    WHERE id = $1
    AND status = 'approved'
  `;

    const result = await pool.query(query, [agentId]);

    return result.rows[0];
  },

  async getLoginUser(loginId) {
    const query = `
      SELECT
        id,
        password,
        role,
        status,
        "isPasswordChanged"
      FROM "Agents"
      WHERE "loginId" = $1
    `;

    const result = await pool.query(query, [loginId]);

    return result.rows[0];
  },

  async findByLoginOrEmail(loginOrEmail) {
    const query = `
      SELECT
        id,
        "loginId",
        email,
        "firstName",
        "lastName",
        password,
        role,
        status,
        "isPasswordChanged"
      FROM "Agents"
      WHERE "loginId" = $1 OR "email" = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [loginOrEmail]);

    return result.rows[0];
  },

  // async trackRequest(referenceNumber) {
  //   const query = `
  //     SELECT *
  //     FROM "Agents"
  //     WHERE "referenceNumber" = $1
  //   `;

  //   const result = await pool.query(query, [referenceNumber]);

  //   return result.rows[0];
  // },

  async trackRequest(referenceNumber) {
    const query = `
      SELECT
        a.*,
        TO_CHAR(a."licenseValidityDate", 'YYYY-MM-DD')
          AS "licenseValidityDate"
      FROM "Agents" a
      WHERE a."referenceNumber" = $1
    `;

    const result = await pool.query(query, [referenceNumber]);

    return result.rows[0];
  },

  async getDocumentPath(referenceNumber, documentType) {
    let columnName;
    switch (documentType) {
      case "workOrder":
        columnName = "workOrder";
        break;
      case "pan":
        columnName = "panDoc";
        break;
      case "gst":
        columnName = "gstinDoc";
        break;
      case "tan":
        columnName = "tanDoc";
        break;
      case "requisitionLetter":
        columnName = "requisitionLetter";
        break;
      default:
        throw new Error("Invalid document type");
    }

    const query = `
      SELECT "${columnName}"
      FROM "Agents"
      WHERE "referenceNumber" = $1
    `;

    const result = await pool.query(query, [referenceNumber]);

    return result.rows[0];
  },

  async updateAgentByReference(referenceNumber, payload) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      /* =================================
        STEP 1 — Lock Agent Row
      ================================= */

      const agentQuery = `
        SELECT *
        FROM "Agents"
        WHERE "referenceNumber"=$1
        FOR UPDATE
      `;

      const agentResult = await client.query(agentQuery, [referenceNumber]);

      if (!agentResult.rows.length) {
        await client.query("ROLLBACK");

        return {
          success: false,
          message: "Agent not found",
        };
      }

      const agent = agentResult.rows[0];

      /* =================================
        STEP 2 — Check edit permission
      ================================= */

      if (agent.status !== "pending" && agent.status !== "reverted") {
        await client.query("ROLLBACK");

        return {
          success: false,
          message: "Agent cannot be edited after approval process",
        };
      }

      /* =================================
        STEP 3 — Duplicate check
      ================================= */

      const duplicateCheckQuery = `
        SELECT id
        FROM "Agents"
        WHERE
        ("email"=$1 OR "mobileNo"=$2 OR "panNumber"=$3 OR "gstinNumber"=$4)
        AND "referenceNumber"<>$5
        LIMIT 1
      `;

      const duplicateResult = await client.query(duplicateCheckQuery, [
        payload.email || agent.email,
        payload.mobileNo || agent.mobileNo,
        payload.panNumber || agent.panNumber,
        payload.gstinNumber || agent.gstinNumber,
        referenceNumber,
      ]);

      if (duplicateResult.rows.length) {
        await client.query("ROLLBACK");

        return {
          success: false,
          message: "Duplicate email/mobile/PAN/GST detected",
        };
      }

      /* =================================
        STEP 4 — File Replacement
      ================================= */

      const fs = require("fs");

      const replaceFile = (oldFile, newFile) => {
        if (newFile) {
          if (oldFile && fs.existsSync(oldFile)) {
            fs.unlinkSync(oldFile);
          }

          return newFile;
        }

        return oldFile;
      };

      const workOrder = replaceFile(agent.workOrder, payload.workOrder);
      const requisitionLetter = replaceFile(agent.requisitionLetter, payload.requisitionLetter);
      const gstinDoc = replaceFile(agent.gstinDoc, payload.gstinDoc);
      const panDoc = replaceFile(agent.panDoc, payload.panDoc);
      const tanDoc = replaceFile(agent.tanDoc, payload.tanDoc);

      /* =================================
        STEP 5 — Update Query
      ================================= */

      const updateQuery = `
        UPDATE "Agents"
        SET

        "entityName"=$1,
        "mobileNo"=$2,
        "email"=$3,

        "addressLine"=$4,
        "city"=$5,
        "state"=$6,
        "pincode"=$7,
        "country"=$8,

        "gstinNumber"=$9,
        "panNumber"=$10,
        "tanNumber"=$11,

        "remark"=$12,
        "title"=$13,
        "firstName"=$14,
        "lastName"=$15,
        "contactMobile"=$16,
        "contactEmail"=$17,

        "workOrder"=$18,
        "requisitionLetter"=$19,
        "gstinDoc"=$20,
        "panDoc"=$21,
        "tanDoc"=$22,

        "status"='pending',
        "rejectedReason"=NULL,
        "updatedAt"=CURRENT_TIMESTAMP

        WHERE "referenceNumber"=$23
        RETURNING *
      `;

      const values = [
        payload.entityName || agent.entityName,
        payload.mobileNo || agent.mobileNo,
        payload.email || agent.email,

        payload.addressLine || agent.addressLine,
        payload.city || agent.city,
        payload.state || agent.state,
        payload.pincode || agent.pincode,
        payload.country || agent.country,

        payload.gstinNumber || agent.gstinNumber,
        payload.panNumber || agent.panNumber,
        payload.tanNumber || agent.tanNumber,

        payload.remark || agent.remark,
        payload.title || agent.title,
        payload.firstName || agent.firstName,
        payload.lastName || agent.lastName,
        payload.contactMobile || agent.contactMobile,
        payload.contactEmail || agent.contactEmail,

        workOrder,
        requisitionLetter,
        gstinDoc,
        panDoc,
        tanDoc,

        referenceNumber,
      ];

      const result = await client.query(updateQuery, values);

      await client.query("COMMIT");

      return {
        success: true,
        data: result.rows[0],
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async revertAgent(agentId, reason, approvedByUserId) {
    let approvedBy = null;
    if (approvedByUserId) {
      try {
        const userRes = await pool.query('SELECT "userName" FROM "users" WHERE id = $1', [approvedByUserId]);
        if (userRes.rows.length > 0) {
          approvedBy = userRes.rows[0].userName;
        }
      } catch (err) {
        console.error("Error fetching agent revertor username:", err);
      }
    }
    const query = `
      UPDATE "Agents"
      SET
        "status" = 'reverted',
        "rejectedReason" = $2,
        "isApproved" = false,
        "approvedBy" = $3
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [agentId, reason, approvedBy]);

    return result.rows[0];
  },

  async changePassword(
    loginId,
    newPassword
  ) {

    const query = `
      SELECT
        id,
        password,
        "isPasswordChanged"
      FROM "Agents"
      WHERE "loginId" = $1
    `;

    const result =
      await pool.query(query, [loginId]);

    if (!result.rows.length) {

      return {
        success: false,
        message: "User not found"
      };

    }

    const user = result.rows[0];

    const samePassword =
      await bcrypt.compare(
        newPassword,
        user.password
      );

    if (samePassword) {

      return {
        success: false,
        message:
          "New password cannot be same as existing password"
      };

    }

    const hashedPassword =
      await bcrypt.hash(
        newPassword,
        12
      );

    await pool.query(
      `
      UPDATE "Agents"
      SET
        password = $1,
        "isPasswordChanged" = true,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [
        hashedPassword,
        user.id
      ]
    );

    return {
      success: true,
      message:
        "Password changed successfully"
    };

  },

  async findAgentByIdentifier(identifier) {

    const query = `
      SELECT
        id,
        "loginId",
        email,
        "firstName",
        "isApproved"
      FROM "Agents"
      WHERE
        "loginId" = $1
        OR email = $1
      LIMIT 1
    `;

    const result =
      await pool.query(query, [identifier]);

    return result.rows[0] || null;

  },

  async updateForgotPassword(loginId,hashedPassword) {

    const query = `
      UPDATE "Agents"
      SET
        password = $1,
        "isPasswordChanged" = true,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "loginId" = $2
    `;

    await pool.query(query, [
      hashedPassword,
      loginId,
    ]);

  },
};

module.exports = Agent;
