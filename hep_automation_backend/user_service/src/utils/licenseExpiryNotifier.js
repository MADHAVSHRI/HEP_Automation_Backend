const { pool } = require("../dbconfig/db");
const { sendEmailEvent } = require("./kafka/producer");

/**
 * Checks for agents whose license validity expires in N days (supports array of notice days e.g. [30, 15, 7, 1])
 * and triggers automated email warning notifications.
 */
async function checkAndNotifyLicenseExpirations() {
  try {
    const rawNotice = process.env.LICENSE_EXPIRY_NOTICE_DAYS || "30,15,7,1";
    const noticeDaysList = rawNotice.split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));

    for (const noticeDays of noticeDaysList) {
      const query = `
        SELECT
          a.id,
          a."entityName",
          a.email,
          a."contactEmail",
          a."licenseNumber",
          a."licenseValidityDate",
          (a."licenseValidityDate"::date - CURRENT_DATE) AS "daysRemaining"
        FROM "Agents" a
        WHERE
          a."licenseValidityDate" IS NOT NULL
          AND a.status = 'approved'
          AND (a."isLifetimeLicense" IS NOT TRUE)
          AND (a."licenseValidityDate"::date - CURRENT_DATE) = $1
          AND NOT EXISTS (
            SELECT 1 FROM "AgentProfileUpdateRequests" r
            WHERE r."agentId" = a.id
              AND r.status = 'pending'
              AND (r."licenseValidityDate" IS NOT NULL OR r."isLifetimeLicense" = true)
          );
      `;

      const res = await pool.query(query, [noticeDays]);

      if (res.rows.length > 0) {
        console.log(`[LicenseExpiryNotifier] Found ${res.rows.length} agent(s) with license expiring in ${noticeDays} day(s). Sending email warnings...`);

        for (const agent of res.rows) {
          try {
            const targetEmail = agent.email;
            if (!targetEmail) continue;

            await sendEmailEvent({
              type: "LICENSE_EXPIRY_WARNING",
              email: targetEmail,
              name: agent.entityName,
              licenseNumber: agent.licenseNumber,
              licenseValidityDate: agent.licenseValidityDate,
              daysRemaining: noticeDays,
            });
            console.log(`[LicenseExpiryNotifier] Warning email event queued for ${targetEmail} (${agent.entityName})`);
          } catch (emailErr) {
            console.error(`[LicenseExpiryNotifier] Failed to send email to ${agent.email}:`, emailErr.message);
          }
        }
      }
    }
  } catch (error) {
    console.error("[LicenseExpiryNotifier] Check error:", error.message);
  }
}

function startLicenseExpiryNotifierCron() {
  // 1. Run check immediately on startup
  checkAndNotifyLicenseExpirations();

  // 2. Schedule to run every 24 hours (86,400,000 ms)
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(checkAndNotifyLicenseExpirations, TWENTY_FOUR_HOURS);
}

module.exports = {
  checkAndNotifyLicenseExpirations,
  startLicenseExpiryNotifierCron,
};
