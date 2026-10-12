const { pool } = require("../dbconfig/db");
const { notifyConversionExpired } = require("./essentialPassEmailService");

/**
 * Checks for approved essential pass conversions whose conversionEndDate has passed (conversionEndDate < NOW()),
 * marks them as EXPIRED, updates entity workflow state, and sends reversion emails to agents and pass holders.
 */
async function checkAndExpireEssentialPasses() {
  const client = await pool.connect();
  try {
    const selectQuery = `
      SELECT 
        epc.id,
        epc."passRequestId",
        epc."entityType",
        epc."entityId",
        epc."departmentId",
        epc."conversionStartDate",
        epc."conversionEndDate",
        pr."referenceNo",
        COALESCE(a.email, a."contactEmail") AS "agentEmail",
        COALESCE(a."entityName", CONCAT(a."firstName", ' ', a."lastName"), 'Applicant') AS "agentName",
        pp.name AS "personName",
        pp."personPassNo",
        pp.email AS "personEmail",
        pp."dateTo" AS "personDateTo",
        pv."registrationNo" AS "vehicleRegNo",
        pv."vehiclePassNo",
        pv."dateTo" AS "vehicleDateTo"
      FROM essential_pass_conversions epc
      JOIN pass_requests pr ON pr.id = epc."passRequestId"
      LEFT JOIN "Agents" a ON a.id = pr."agentId"
      LEFT JOIN pass_persons pp ON (epc."entityType" = 'person' AND pp.id = epc."entityId")
      LEFT JOIN pass_vehicles pv ON (epc."entityType" = 'vehicle' AND pv.id = epc."entityId")
      WHERE epc.status = 'APPROVED'
        AND epc."conversionEndDate" IS NOT NULL
        AND epc."conversionEndDate" < NOW()
      ORDER BY epc.id ASC
    `;

    const res = await client.query(selectQuery);

    if (res.rows.length === 0) {
      return;
    }

    console.log(
      `[EssentialPassExpiryJob] Found ${res.rows.length} expired essential conversion(s). Processing reversion...`
    );

    for (const row of res.rows) {
      try {
        await client.query("BEGIN");

        // 1. Mark conversion as EXPIRED
        await client.query(
          `UPDATE essential_pass_conversions
           SET status = 'EXPIRED',
               "workflowState" = 'EXPIRED_CONVERSION',
               "updatedAt" = NOW()
           WHERE id = $1`,
          [row.id]
        );

        // 2. Update entity table workflow state
        if (row.entityType === "person") {
          await client.query(
            `UPDATE pass_persons
             SET "essentialWorkflowState" = 'EXPIRED_PERSON_ESSENTIAL',
                 "updatedAt" = NOW()
             WHERE id = $1`,
            [row.entityId]
          );
        } else {
          await client.query(
            `UPDATE pass_vehicles
             SET "essentialWorkflowState" = 'EXPIRED_VEHICLE_ESSENTIAL',
                 "updatedAt" = NOW()
             WHERE id = $1`,
            [row.entityId]
          );
        }

        await client.query("COMMIT");

        // 3. Prepare details for email notification
        const isPerson = row.entityType === "person";
        const entityName = isPerson
          ? row.personName || `Person #${row.entityId}`
          : row.vehicleRegNo || `Vehicle #${row.entityId}`;
        const passNo = isPerson ? row.personPassNo : row.vehiclePassNo;
        const originalPassValidUpto = isPerson
          ? row.personDateTo
          : row.vehicleDateTo;

        const emailPayload = {
          agentName: row.agentName,
          entityName,
          entityType: row.entityType,
          passNo: passNo || "N/A",
          referenceNo: row.referenceNo,
          conversionStartDate: row.conversionStartDate,
          conversionEndDate: row.conversionEndDate,
          originalPassValidUpto,
        };

        // Send to agent
        if (row.agentEmail) {
          await notifyConversionExpired({
            ...emailPayload,
            email: row.agentEmail,
          });
        }

        // Also notify individual person if person has a separate email
        if (
          isPerson &&
          row.personEmail &&
          row.personEmail.toLowerCase() !== (row.agentEmail || "").toLowerCase()
        ) {
          await notifyConversionExpired({
            ...emailPayload,
            email: row.personEmail,
          });
        }

        console.log(
          `[EssentialPassExpiryJob] Successfully processed reversion and notified for conversion ID ${row.id} (${entityName})`
        );
      } catch (itemErr) {
        await client.query("ROLLBACK");
        console.error(
          `[EssentialPassExpiryJob] Error reverting conversion ID ${row.id}:`,
          itemErr.message
        );
      }
    }
  } catch (error) {
    console.error("[EssentialPassExpiryJob] Check error:", error.message);
  } finally {
    client.release();
  }
}

/**
 * Initializes and starts the background expiry job.
 */
function startEssentialPassExpiryCron() {
  // 1. Run check immediately on startup
  checkAndExpireEssentialPasses().catch((err) =>
    console.error("[EssentialPassExpiryJob] Startup run error:", err.message)
  );

  // 2. Schedule to run every 30 minutes (1,800,000 ms)
  const THIRTY_MINUTES = 30 * 60 * 1000;
  setInterval(checkAndExpireEssentialPasses, THIRTY_MINUTES);
}

module.exports = {
  checkAndExpireEssentialPasses,
  startEssentialPassExpiryCron,
};
