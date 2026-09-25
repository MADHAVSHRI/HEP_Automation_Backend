/**
 * bulkPassExpiryJob.js
 * Runs daily at 8 AM (scheduled from src/index.js).
 *
 * A reusable Bulk Pass simply stops accepting batches when its validity window
 * closes — nothing announces it. Organisations would only discover this by
 * opening the link and finding submissions shut. This job gives them warning.
 *
 * The work itself lives in user_service, which owns the bulk pass tables and
 * already talks to email_service; this job only triggers it on a schedule.
 * user_service stamps each pass once it is notified, so a repeated or retried
 * run never mails the same organisation twice.
 */
const axios = require("axios");

const REMINDER_DAYS = Number(process.env.BULK_PASS_EXPIRY_REMINDER_DAYS) || 3;

async function bulkPassExpiryJob() {
  console.log("[BulkPassExpiryJob] Starting daily bulk pass expiry reminder run…");

  const userServiceUrl = process.env.USER_SERVICE_URL;
  if (!userServiceUrl) {
    console.warn("[BulkPassExpiryJob] USER_SERVICE_URL not configured — skipping run.");
    return;
  }

  try {
    const response = await axios.post(
      `${userServiceUrl}/api/bulk-pass/internal/send-expiry-reminders`,
      { days: REMINDER_DAYS },
      {
        headers: {
          "x-service-name": "APPROVAL-ADMIN-SERVICE",
          "x-service-key": process.env.SERVICE_AUTH_KEY || "",
        },
        timeout: 60000,
      }
    );

    const result = response.data?.data || {};
    console.log(
      `[BulkPassExpiryJob] Considered ${result.considered ?? 0} pass(es); ` +
        `notified ${result.notified ?? 0}, failed ${result.failed ?? 0}.`
    );
  } catch (err) {
    // A failed run is safe to skip: nothing was stamped, so tomorrow's run
    // picks up the same passes.
    console.error(
      "[BulkPassExpiryJob] Run failed:",
      err.response?.data?.message || err.message
    );
  }
}

module.exports = bulkPassExpiryJob;
