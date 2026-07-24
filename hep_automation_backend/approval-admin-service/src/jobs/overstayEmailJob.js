/**
 * overstayEmailJob.js
 * Runs daily at 9 AM (scheduled from src/index.js).
 * Queries all PENDING overstay_charges not emailed today,
 * sends a Kafka event of type OVERSTAY_REMINDER per charge.
 */
const Overstay = require("../models/overstaySchema");
const sendEmailEvent = require("../utils/kafka/producer");

async function overstayEmailJob() {
  console.log("[OvstayJob] Starting daily overstay reminder email run…");
  try {
    const charges = await Overstay.fetchPendingForEmail();
    console.log(`[OvstayJob] Found ${charges.length} pending charge(s) to notify.`);

    for (const charge of charges) {
      try {
        await sendEmailEvent({
          type: "OVERSTAY_REMINDER",
          email: charge.agent_email,
          company_name: charge.company_name,
          identifier: charge.identifier,
          entity_type: charge.entity_type,
          pass_no: charge.pass_no,
          date_to: charge.date_to,
          overstay_days: charge.overstay_days,
          total_amount: charge.total_amount,
          charge_id: charge.id,
        });
        await Overstay.markEmailSent(charge.id);
        console.log(`[OvstayJob] Reminder sent for charge #${charge.id} (${charge.identifier})`);
      } catch (sendErr) {
        console.warn(`[OvstayJob] Failed to send reminder for charge #${charge.id}:`, sendErr.message);
      }
    }
    console.log("[OvstayJob] Daily run complete.");
  } catch (err) {
    console.error("[OvstayJob] Fatal error during daily run:", err.message);
  }
}

module.exports = overstayEmailJob;
