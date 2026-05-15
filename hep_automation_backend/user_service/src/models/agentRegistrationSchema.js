const { pool } = require("../dbconfig/db");

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
        "entityFile",
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
        $23, $24, $25, $26, $27  -- Update to include the new placeholder for updatedAt
      )
      RETURNING *
    `;

    const values = [
      agentData.userTypeId,
      agentData.userTypeName,
      agentData.entityName,
      agentData.mobileNo,
      agentData.email,
      agentData.entityFile,
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

  async getAllRegisteredAgents(isApproved, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    let query = `
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
        "isRefNoSentByEmail",
        "isCredentialSentByEmail",
        "createdAt",
        "updatedAt"
      FROM "Agents"
    `;

    let values = [];

    if (isApproved !== undefined) {
      query += ` WHERE "isApproved" = $1`;
      values.push(isApproved === "true");
      query += ` ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`;
      values.push(limit, offset);
    } else {
      query += ` ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2`;
      values.push(limit, offset);
    }

    const result = await pool.query(query, values);
    return result.rows;
  },

  async updateEmailStatusByReference(referenceNumber) {
    const query = `
    UPDATE "Agents"
    SET "isRefNoSentByEmail" = true
    WHERE "referenceNumber" = $1
  `;

    await pool.query(query, [referenceNumber]);
  },

  async approveAgent(agentId, loginId, password) {
    const query = `
      UPDATE "Agents"
      SET
        "isApproved" = true,
        "status" = 'approved',
        "loginId" = $2,
        "password" = $3
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [agentId, loginId, password]);

    return result.rows[0];
  },

  async rejectAgent(agentId, reason) {
    const query = `
      UPDATE "Agents"
      SET
        "status"='rejected',
        "rejectedReason"=$2
      WHERE id=$1
      RETURNING *
    `;

    const result = await pool.query(query, [agentId, reason]);

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
        status
      FROM "Agents"
      WHERE "loginId" = $1
    `;

    const result = await pool.query(query, [loginId]);

    return result.rows[0];
  },

  async trackRequest(referenceNumber) {
    const query = `
      SELECT *
      FROM "Agents"
      WHERE "referenceNumber" = $1
    `;

    const result = await pool.query(query, [referenceNumber]);

    return result.rows[0];
  },

  async getDocumentPath(referenceNumber, documentType) {
    let columnName;
    switch (documentType) {
      case "entity":
        columnName = "entityFile";
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

      const entityFile = replaceFile(agent.entityFile, payload.entityFile);
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

        "entityFile"=$18,
        "gstinDoc"=$19,
        "panDoc"=$20,
        "tanDoc"=$21,

        "status"='pending',
        "rejectedReason"=NULL,
        "updatedAt"=CURRENT_TIMESTAMP

        WHERE "referenceNumber"=$22
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

        entityFile,
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

  async revertAgent(agentId, reason) {
    const query = `
      UPDATE "Agents"
      SET
        "status" = 'reverted',
        "rejectedReason" = $2,
        "isApproved" = false
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [agentId, reason]);

    return result.rows[0];
  },
};

module.exports = Agent;
