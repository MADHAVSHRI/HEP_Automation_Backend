const { pool } = require("../dbconfig/db");
const ReferenceNumber = require("./referenceNumberSchema");

const AgentProfileUpdateRequest = {
  /**
   * Create a new Profile & License Update Request
   */
  async createRequest(payload) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Check if a reverted request exists for this agent to preserve referenceNumber
      const existingRevertedQuery = `
        SELECT id, "referenceNumber"
        FROM "AgentProfileUpdateRequests"
        WHERE "agentId" = $1 AND "status" = 'reverted'
        ORDER BY "createdAt" DESC
        LIMIT 1;
      `;
      const existingRevertedRes = await client.query(existingRevertedQuery, [payload.agentId]);

      if (existingRevertedRes.rows.length > 0) {
        const existingId = existingRevertedRes.rows[0].id;
        const updateQuery = `
          UPDATE "AgentProfileUpdateRequests"
          SET
            "userTypeName" = $1,
            "entityName" = $2,
            "entityNameDoc" = COALESCE($3, "entityNameDoc"),
            "authorizedPersonName" = $4,
            "mobileNo" = $5,
            "email" = $6,
            "addressLine" = $7,
            "city" = $8,
            "state" = $9,
            "pincode" = $10,
            "addressDoc" = COALESCE($11, "addressDoc"),
            "licenseNumber" = $12,
            "licenseValidityDate" = $13,
            "licenseDoc" = COALESCE($14, "licenseDoc"),
            "gstinNumber" = $15,
            "gstinDoc" = COALESCE($16, "gstinDoc"),
            "panNumber" = $17,
            "panDoc" = COALESCE($18, "panDoc"),
            "tanNumber" = $19,
            "tanDoc" = COALESCE($20, "tanDoc"),
            "remarks" = $21,
            "status" = 'pending',
            "rejectedReason" = NULL,
            "processedBy" = NULL,
            "processedAt" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $22
          RETURNING *;
        `;
        const updateValues = [
          payload.userTypeName || null,
          payload.entityName || null,
          payload.entityNameDoc || null,
          payload.authorizedPersonName || null,
          payload.mobileNo || null,
          payload.email || null,
          payload.addressLine || null,
          payload.city || null,
          payload.state || null,
          payload.pincode || null,
          payload.addressDoc || null,
          payload.licenseNumber || null,
          payload.licenseValidityDate || null,
          payload.licenseDoc || null,
          payload.gstinNumber || null,
          payload.gstinDoc || null,
          payload.panNumber || null,
          payload.panDoc || null,
          payload.tanNumber || null,
          payload.tanDoc || null,
          payload.remarks || null,
          existingId,
        ];
        const res = await client.query(updateQuery, updateValues);
        await client.query("COMMIT");
        return res.rows[0];
      }

      // Generate PUR reference number if creating new request
      const referenceNumber = await ReferenceNumber.generateProfileUpdateReference(client);

      const query = `
        INSERT INTO "AgentProfileUpdateRequests" (
          "agentId",
          "referenceNumber",
          "userTypeName",
          "entityName",
          "entityNameDoc",
          "authorizedPersonName",
          "mobileNo",
          "email",
          "addressLine",
          "city",
          "state",
          "pincode",
          "addressDoc",
          "licenseNumber",
          "licenseValidityDate",
          "licenseDoc",
          "gstinNumber",
          "gstinDoc",
          "panNumber",
          "panDoc",
          "tanNumber",
          "tanDoc",
          "remarks",
          "status"
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, 'pending'
        )
        RETURNING *;
      `;

      const values = [
        payload.agentId,
        referenceNumber,
        payload.userTypeName || null,
        payload.entityName || null,
        payload.entityNameDoc || null,
        payload.authorizedPersonName || null,
        payload.mobileNo || null,
        payload.email || null,
        payload.addressLine || null,
        payload.city || null,
        payload.state || null,
        payload.pincode || null,
        payload.addressDoc || null,
        payload.licenseNumber || null,
        payload.licenseValidityDate || null,
        payload.licenseDoc || null,
        payload.gstinNumber || null,
        payload.gstinDoc || null,
        payload.panNumber || null,
        payload.panDoc || null,
        payload.tanNumber || null,
        payload.tanDoc || null,
        payload.remarks || null,
      ];

      const res = await client.query(query, values);
      await client.query("COMMIT");
      return res.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get current active (pending) profile update request for an agent
   */
  async getPendingRequestByAgentId(agentId) {
    const query = `
      SELECT *
      FROM "AgentProfileUpdateRequests"
      WHERE "agentId" = $1 AND "status" = 'pending'
      ORDER BY "createdAt" DESC
      LIMIT 1;
    `;
    const res = await pool.query(query, [agentId]);
    return res.rows[0] || null;
  },

  /**
   * Get latest request for an agent regardless of status
   */
  async getLatestRequestByAgentId(agentId) {
    const query = `
      SELECT *
      FROM "AgentProfileUpdateRequests"
      WHERE "agentId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 1;
    `;
    const res = await pool.query(query, [agentId]);
    return res.rows[0] || null;
  },

  /**
   * Get paginated requests for Traffic Approver
   */
  async getAllRequests(pagination = {}) {
    const {
      page = 1,
      limit = 20,
      offset = 0,
      search = "",
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
        console.error("Error looking up user for profile update filter:", err);
      }
    }

    const searchWhere = [];
    const searchParams = [];
    let i = 1;

    if (search) {
      const searchParam = `%${search}%`;
      searchWhere.push(`(
        r."entityName" ILIKE $${i}
        OR r."mobileNo" ILIKE $${i}
        OR r."email" ILIKE $${i}
        OR r."referenceNumber" ILIKE $${i}
        OR a."referenceNumber" ILIKE $${i}
      )`);
      searchParams.push(searchParam);
      i++;
    }

    const searchWhereSql = searchWhere.length ? `WHERE ${searchWhere.join(" AND ")}` : "";

    // Count query
    const countQuery = `
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN r.status = 'approved' ${processedByMe && approvedByUserName ? `AND r."processedBy" = $${searchParams.length + 1}` : ""} THEN 1 END) AS approved,
        COUNT(CASE WHEN r.status = 'rejected' ${processedByMe && approvedByUserName ? `AND r."processedBy" = $${searchParams.length + 1}` : ""} THEN 1 END) AS rejected,
        COUNT(CASE WHEN r.status = 'pending' THEN 1 END) AS pending,
        COUNT(CASE WHEN r.status = 'reverted' THEN 1 END) AS reverted
      FROM "AgentProfileUpdateRequests" r
      JOIN "Agents" a ON r."agentId" = a.id
      ${searchWhereSql}
    `;

    const countParams = [...searchParams];
    if (processedByMe && approvedByUserName) {
      countParams.push(approvedByUserName);
    }

    const countRes = await pool.query(countQuery, countParams);
    const counts = {
      total: parseInt(countRes.rows[0]?.total || 0),
      approved: parseInt(countRes.rows[0]?.approved || 0),
      rejected: parseInt(countRes.rows[0]?.rejected || 0),
      reverted: parseInt(countRes.rows[0]?.reverted || 0),
      pending: parseInt(countRes.rows[0]?.pending || 0),
    };

    const listWhere = [...searchWhere];
    const listParams = [...searchParams];
    let j = i;

    if (status === "pending") {
      listWhere.push(`r."status" = 'pending'`);
    } else if (status === "processed") {
      listWhere.push(`r."status" IN ('approved', 'rejected', 'reverted')`);
      if (processedByMe && approvedByUserName) {
        listWhere.push(`r."processedBy" = $${j++}`);
        listParams.push(approvedByUserName);
      }
    } else if (status) {
      listWhere.push(`r."status" = $${j++}`);
      listParams.push(status);
      if (processedByMe && approvedByUserName && (status === "approved" || status === "rejected" || status === "reverted")) {
        listWhere.push(`r."processedBy" = $${j++}`);
        listParams.push(approvedByUserName);
      }
    }

    const listWhereSql = listWhere.length ? `WHERE ${listWhere.join(" AND ")}` : "";

    const queryParams = [...listParams, limit, offset];
    const query = `
      SELECT
        r.id,
        r."agentId",
        r."referenceNumber",
        r."userTypeName",
        r."entityName",
        r."entityNameDoc",
        r."authorizedPersonName",
        r."mobileNo",
        r."email",
        r."addressLine",
        r."city",
        r."state",
        r."pincode",
        r."addressDoc",
        r."licenseNumber",
        TO_CHAR(r."licenseValidityDate", 'YYYY-MM-DD') AS "licenseValidityDate",
        r."licenseDoc",
        r."gstinNumber",
        r."gstinDoc",
        r."panNumber",
        r."panDoc",
        r."tanNumber",
        r."tanDoc",
        r."remarks",
        r."status",
        r."rejectedReason",
        r."processedBy",
        r."processedAt",
        r."createdAt",
        r."updatedAt",
        a."entityName" AS "currentEntityName",
        a."firstName" AS "currentFirstName",
        a."lastName" AS "currentLastName",
        a."mobileNo" AS "currentMobileNo",
        a."email" AS "currentEmail",
        a."addressLine" AS "currentAddressLine",
        a."city" AS "currentCity",
        a."state" AS "currentState",
        a."pincode" AS "currentPincode",
        a."licenseNumber" AS "currentLicenseNumber",
        TO_CHAR(a."licenseValidityDate", 'YYYY-MM-DD') AS "currentLicenseValidityDate",
        a."licenseDoc" AS "currentLicenseDoc",
        a."gstinNumber" AS "currentGstinNumber",
        a."gstinDoc" AS "currentGstinDoc",
        a."panNumber" AS "currentPanNumber",
        a."panDoc" AS "currentPanDoc",
        a."tanNumber" AS "currentTanNumber",
        a."tanDoc" AS "currentTanDoc",
        a."referenceNumber" AS "agentRegistrationRef"
      FROM "AgentProfileUpdateRequests" r
      JOIN "Agents" a ON r."agentId" = a.id
      ${listWhereSql}
      ORDER BY r."createdAt" DESC
      LIMIT $${j} OFFSET $${j + 1};
    `;

    const res = await pool.query(query, queryParams);
    return { data: res.rows, counts };
  },

  /**
   * Get single request details by ID (including current agent snapshot)
   */
  async getRequestById(id) {
    const query = `
      SELECT
        r.id,
        r."agentId",
        r."referenceNumber",
        r."userTypeName",
        r."entityName",
        r."entityNameDoc",
        r."authorizedPersonName",
        r."mobileNo",
        r."email",
        r."addressLine",
        r."city",
        r."state",
        r."pincode",
        r."addressDoc",
        r."licenseNumber",
        TO_CHAR(r."licenseValidityDate", 'YYYY-MM-DD') AS "licenseValidityDate",
        r."licenseDoc",
        r."gstinNumber",
        r."gstinDoc",
        r."panNumber",
        r."panDoc",
        r."tanNumber",
        r."tanDoc",
        r."remarks",
        r."status",
        r."rejectedReason",
        r."processedBy",
        r."processedAt",
        r."createdAt",
        r."updatedAt",
        a."entityName" AS "currentEntityName",
        a."firstName" AS "currentFirstName",
        a."lastName" AS "currentLastName",
        a."mobileNo" AS "currentMobileNo",
        a."email" AS "currentEmail",
        a."addressLine" AS "currentAddressLine",
        a."city" AS "currentCity",
        a."state" AS "currentState",
        a."pincode" AS "currentPincode",
        a."licenseNumber" AS "currentLicenseNumber",
        TO_CHAR(a."licenseValidityDate", 'YYYY-MM-DD') AS "currentLicenseValidityDate",
        a."licenseDoc" AS "currentLicenseDoc",
        a."gstinNumber" AS "currentGstinNumber",
        a."gstinDoc" AS "currentGstinDoc",
        a."panNumber" AS "currentPanNumber",
        a."panDoc" AS "currentPanDoc",
        a."tanNumber" AS "currentTanNumber",
        a."tanDoc" AS "currentTanDoc",
        a."referenceNumber" AS "agentRegistrationRef"
      FROM "AgentProfileUpdateRequests" r
      JOIN "Agents" a ON r."agentId" = a.id
      WHERE r.id = $1;
    `;
    const res = await pool.query(query, [id]);
    return res.rows[0] || null;
  },

  /**
   * Process decision on profile update request and apply changes if approved
   */
  async processAction(requestId, decision, rejectedReason, processedBy) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let targetStatus = decision;
      if (targetStatus === "approve") targetStatus = "approved";
      if (targetStatus === "revert") targetStatus = "reverted";
      if (targetStatus === "reject") targetStatus = "rejected";

      // 1. Get request
      const reqRes = await client.query('SELECT * FROM "AgentProfileUpdateRequests" WHERE id = $1', [requestId]);
      if (reqRes.rows.length === 0) {
        throw new Error("Profile update request not found");
      }
      const reqData = reqRes.rows[0];

      // 2. Update request status
      const updateReqQuery = `
        UPDATE "AgentProfileUpdateRequests"
        SET
          "status" = $1,
          "rejectedReason" = $2,
          "processedBy" = $3,
          "processedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *;
      `;
      const updatedReqRes = await client.query(updateReqQuery, [targetStatus, rejectedReason || null, processedBy, requestId]);
      const updatedReq = updatedReqRes.rows[0];

      // 3. If approved, apply requested changes to Agents table
      if (targetStatus === "approved") {
        const updateFields = [];
        const updateValues = [];
        let idx = 1;

        const fieldMap = {
          entityName: "entityName",
          mobileNo: "mobileNo",
          email: "email",
          addressLine: "addressLine",
          city: "city",
          state: "state",
          pincode: "pincode",
          licenseNumber: "licenseNumber",
          licenseValidityDate: "licenseValidityDate",
          licenseDoc: "licenseDoc",
          gstinNumber: "gstinNumber",
          gstinDoc: "gstinDoc",
          panNumber: "panNumber",
          panDoc: "panDoc",
          tanNumber: "tanNumber",
          tanDoc: "tanDoc",
        };

        for (const [reqKey, agentCol] of Object.entries(fieldMap)) {
          if (reqData[reqKey] !== null && reqData[reqKey] !== undefined && String(reqData[reqKey]).trim() !== "") {
            if (reqKey === "licenseValidityDate") {
              let cleanDateStr = "";
              const val = reqData[reqKey];
              if (val instanceof Date && !isNaN(val.getTime())) {
                const yyyy = val.getFullYear();
                const mm = String(val.getMonth() + 1).padStart(2, "0");
                const dd = String(val.getDate()).padStart(2, "0");
                cleanDateStr = `${yyyy}-${mm}-${dd}`;
              } else if (typeof val === "string" && val.includes("T")) {
                cleanDateStr = val.split("T")[0];
              } else {
                const dObj = new Date(val);
                if (!isNaN(dObj.getTime())) {
                  const yyyy = dObj.getFullYear();
                  const mm = String(dObj.getMonth() + 1).padStart(2, "0");
                  const dd = String(dObj.getDate()).padStart(2, "0");
                  cleanDateStr = `${yyyy}-${mm}-${dd}`;
                } else {
                  cleanDateStr = String(val).substring(0, 10);
                }
              }
              updateFields.push(`"${agentCol}" = TO_DATE($${idx++}, 'YYYY-MM-DD')`);
              updateValues.push(cleanDateStr);
            } else {
              updateFields.push(`"${agentCol}" = $${idx++}`);
              updateValues.push(reqData[reqKey]);
            }
          }
        }

        if (reqData.authorizedPersonName && String(reqData.authorizedPersonName).trim() !== "") {
          const parts = String(reqData.authorizedPersonName).trim().split(" ");
          const firstName = parts[0];
          const lastName = parts.slice(1).join(" ") || "";
          updateFields.push(`"firstName" = $${idx++}`);
          updateValues.push(firstName);
          updateFields.push(`"lastName" = $${idx++}`);
          updateValues.push(lastName);
        }

        if (updateFields.length > 0) {
          updateFields.push(`"updatedAt" = CURRENT_TIMESTAMP`);
          updateValues.push(reqData.agentId);

          const agentUpdateQuery = `
            UPDATE "Agents"
            SET ${updateFields.join(", ")}
            WHERE id = $${idx}
          `;

          await client.query(agentUpdateQuery, updateValues);
        }
      }

      await client.query("COMMIT");
      return updatedReq;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = AgentProfileUpdateRequest;
