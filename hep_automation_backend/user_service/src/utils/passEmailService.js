const axios = require("axios");
const { pool } = require("../dbconfig/db");

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || "http://localhost:5002";
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || "http://localhost:3000";

/**
 * Dispatches an email request to the email_service.
 */
const postToEmailService = async (endpoint, payload) => {
  if (!EMAIL_SERVICE_URL) {
    console.warn(`[PassEmail] EMAIL_SERVICE_URL not configured; skipping ${endpoint}`);
    return false;
  }

  try {
    const url = `${EMAIL_SERVICE_URL.replace(/\/$/, "")}/api/email/${endpoint}`;
    const response = await axios.post(url, payload, {
      headers: {
        "x-service-name": "USER-SERVICE",
        "Content-Type": "application/json",
      },
      timeout: 8000,
    });

    if (response.data?.success) {
      console.log(`[PassEmail] Successfully dispatched ${endpoint} to ${payload.email}`);
      return true;
    } else {
      console.warn(`[PassEmail] ${endpoint} returned error:`, response.data);
      return false;
    }
  } catch (error) {
    console.error(
      `[PassEmail] Failed to send ${endpoint} to ${payload.email}:`,
      error.response?.data || error.message
    );
    return false;
  }
};

/**
 * Notify agent/company that their pass request has been submitted.
 */
const notifyPassSubmitted = async (passRequestId) => {
  try {
    if (!passRequestId) return false;

    const requestRes = await pool.query(
      `SELECT pr.id, pr."referenceNo", pr."createdAt",
              COALESCE(a.email, u.email) AS "agentEmail",
              COALESCE(a."entityName", a."firstName", u."userName", 'Applicant') AS "agentName"
       FROM pass_requests pr
       LEFT JOIN "Agents" a ON a.id = pr."agentId"
       LEFT JOIN "users" u ON u.id = pr."agentId"
       WHERE pr.id = $1`,
      [passRequestId]
    );

    const reqData = requestRes.rows[0];
    if (!reqData || !reqData.agentEmail) {
      console.warn(`[PassEmail] No agent email found for passRequestId: ${passRequestId}`);
      return false;
    }

    const countsRes = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM pass_persons WHERE "passRequestId" = $1) AS "personsCount",
         (SELECT COUNT(*)::int FROM pass_vehicles WHERE "passRequestId" = $1) AS "vehiclesCount"`,
      [passRequestId]
    );

    const counts = countsRes.rows[0] || { personsCount: 0, vehiclesCount: 0 };

    console.log(
      `[PassEmail] Sending submission email for passRequestId ${passRequestId} (${reqData.referenceNo}) to ${reqData.agentEmail}`
    );

    return await postToEmailService("sendPassSubmitted", {
      email: reqData.agentEmail,
      agentName: reqData.agentName,
      referenceNo: reqData.referenceNo,
      personsCount: counts.personsCount,
      vehiclesCount: counts.vehiclesCount,
      submissionDate: reqData.createdAt,
      portalLink: `${FRONTEND_BASE_URL}/dashboard/pass_request`,
    });
  } catch (err) {
    console.error("[PassEmail] Error in notifyPassSubmitted:", err.message);
    return false;
  }
};

/**
 * Check for and notify agent/company of any newly approved ordinary (or completed) passes.
 * Marks approvalEmailSent = true for each notified entity.
 */
const notifyNewlyApprovedPasses = async (passRequestId) => {
  try {
    if (!passRequestId) return false;

    // Fetch parent request & agent details
    const requestRes = await pool.query(
      `SELECT pr.id, pr."referenceNo",
              COALESCE(a.email, u.email) AS "agentEmail",
              COALESCE(a."entityName", a."firstName", u."userName", 'Applicant') AS "agentName"
       FROM pass_requests pr
       LEFT JOIN "Agents" a ON a.id = pr."agentId"
       LEFT JOIN "users" u ON u.id = pr."agentId"
       WHERE pr.id = $1`,
      [passRequestId]
    );

    const reqData = requestRes.rows[0];
    if (!reqData || !reqData.agentEmail) {
      console.warn(`[PassEmail] No email found for passRequestId ${passRequestId}`);
      return false;
    }

    // Query approved persons that haven't been emailed yet
    const personsRes = await pool.query(
      `SELECT pp.id, pp.name, pp."personPassNo", pp."dateTo",
              COALESCE(d.name, pp."designationOther", '—') AS designation
       FROM pass_persons pp
       LEFT JOIN designations d ON d.id = pp."designationId"
       WHERE pp."passRequestId" = $1
         AND pp.status = 'approved'
         AND (pp."approvalEmailSent" IS FALSE OR pp."approvalEmailSent" IS NULL)`,
      [passRequestId]
    );

    // Query approved vehicles that haven't been emailed yet
    const vehiclesRes = await pool.query(
      `SELECT pv.id, pv."registrationNo", pv."vehiclePassNo", pv."dateTo",
              COALESCE(vt.name, '—') AS "vehicleType"
       FROM pass_vehicles pv
       LEFT JOIN vehicle_types vt ON vt.id = pv."vehicleTypeId"
       WHERE pv."passRequestId" = $1
         AND pv.status = 'approved'
         AND (pv."approvalEmailSent" IS FALSE OR pv."approvalEmailSent" IS NULL)`,
      [passRequestId]
    );

    const approvedPersons = personsRes.rows;
    const approvedVehicles = vehiclesRes.rows;

    if (approvedPersons.length === 0 && approvedVehicles.length === 0) {
      // Nothing newly approved
      return false;
    }

    console.log(
      `[PassEmail] Sending approved email for passRequestId ${passRequestId} (${reqData.referenceNo}) to ${reqData.agentEmail}: ${approvedPersons.length} persons, ${approvedVehicles.length} vehicles`
    );

    const emailSent = await postToEmailService("sendPassApproved", {
      email: reqData.agentEmail,
      agentName: reqData.agentName,
      referenceNo: reqData.referenceNo,
      approvedPersons: approvedPersons.map((p) => ({
        name: p.name,
        personPassNo: p.personPassNo,
        designation: p.designation,
        validUpto: p.dateTo,
      })),
      approvedVehicles: approvedVehicles.map((v) => ({
        registrationNo: v.registrationNo,
        vehiclePassNo: v.vehiclePassNo,
        vehicleType: v.vehicleType,
        validUpto: v.dateTo,
      })),
      portalLink: `${FRONTEND_BASE_URL}/dashboard/pass_request`,
    });

    if (emailSent) {
      // Mark as emailed
      if (approvedPersons.length > 0) {
        const personIds = approvedPersons.map((p) => p.id);
        await pool.query(
          `UPDATE pass_persons SET "approvalEmailSent" = true WHERE id = ANY($1::int[])`,
          [personIds]
        );
      }
      if (approvedVehicles.length > 0) {
        const vehicleIds = approvedVehicles.map((v) => v.id);
        await pool.query(
          `UPDATE pass_vehicles SET "approvalEmailSent" = true WHERE id = ANY($1::int[])`,
          [vehicleIds]
        );
      }
    }

    return emailSent;
  } catch (err) {
    console.error("[PassEmail] Error in notifyNewlyApprovedPasses:", err.message);
    return false;
  }
};

module.exports = {
  notifyPassSubmitted,
  notifyNewlyApprovedPasses,
};
