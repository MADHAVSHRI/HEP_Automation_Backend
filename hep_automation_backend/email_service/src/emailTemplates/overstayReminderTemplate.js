/**
 * overstayReminderTemplate.js
 * Email template for OVERSTAY_REMINDER Kafka event.
 *
 * Per SRS §5.6.7 — Overstay Charges:
 *   - Sent daily to the agent login ID when an unpaid overstay charge exists.
 *   - Must clearly state: charge accumulates every day.
 *   - Options available to the agent:
 *       1. Provide proof of Gate OUT (exit) transaction.
 *       2. Pay the overstay penalty.
 *       3. Request an exception with reason (approved/rejected by Traffic dept).
 */
function overstayReminderTemplate({
  company_name,
  login_id,
  identifier,
  entity_type,
  pass_no,
  date_to,
  overstay_days,
  total_amount,
  daily_rate,
  charge_id,
}) {
  const formattedExpiry = date_to
    ? new Date(date_to).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "N/A";

  const formattedTotal = `₹${parseFloat(total_amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const formattedDailyRate = daily_rate
    ? `₹${parseFloat(daily_rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

  const entityLabel =
    entity_type === "VEHICLE" ? "Vehicle" : entity_type === "DRIVER" ? "Driver" : "Person";

  const portalUrl = process.env.AGENT_PORTAL_URL || "http://localhost:3000";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Overstay Charge Reminder — Chennai Port APACS</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 28px rgba(0,0,0,0.09);">

        <!-- ── Header ── -->
        <tr>
          <td style="background:linear-gradient(135deg,#0a1e4d 0%,#1a3a6e 100%);padding:28px 36px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.3px;">
              Chennai Port Authority
            </h1>
            <p style="margin:6px 0 0;color:#93b4e8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.2px;">
              APACS — Automated Port Access &amp; Control System
            </p>
          </td>
        </tr>

        <!-- ── Urgent Alert Banner ── -->
        <tr>
          <td style="background:#fef2f2;border-left:5px solid #dc2626;padding:14px 36px;">
            <p style="margin:0;color:#dc2626;font-size:14px;font-weight:800;">
              ⚠ ACTION REQUIRED: Your Port Pass Has Expired
            </p>
          </td>
        </tr>

        <!-- ── Body ── -->
        <tr>
          <td style="padding:30px 36px 20px;">

            <p style="margin:0 0 6px;color:#374151;font-size:15px;line-height:1.6;">
              Dear <strong>${company_name || "Agent"}</strong>${login_id ? ` (Login ID: <strong>${login_id}</strong>)` : ""},
            </p>
            <p style="margin:0 0 22px;color:#64748b;font-size:13px;line-height:1.75;">
              This is an official automated notice from the <strong>Chennai Port Authority — Pass Section.</strong>
            </p>
            <p style="margin:0 0 22px;color:#374151;font-size:14px;line-height:1.75;">
              Your <strong>${entityLabel}</strong> Port Pass expired on
              <strong>${formattedExpiry}</strong>.
              If the ${entityLabel.toLowerCase()} continues to remain within the Chennai Port
              premises beyond the pass expiry date, overstay charges will be levied.
              <strong>New pass applications will not be issued until all applicable
              overstay charges have been paid.</strong>
            </p>

            <!-- ── Daily Accrual Warning ── -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:14px 18px;">
                  📅 <strong>Important:</strong>
                  Overstay charges are calculated for each day the entity remains inside the port after pass expiry. The outstanding amount will continue to increase until a valid Gate-OUT transaction is recorded or the applicable charges are settled.
                </td>
              </tr>
            </table>

            <!-- ── Options Available ── -->
            <p style="margin:0 0 12px;color:#0f172a;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">
              What can you do?
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-collapse:separate;border-spacing:0 8px;">

              <!-- Option 1: Proof of Exit -->
              <tr>
                <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;vertical-align:top;width:32px;">
                  <span style="color:#16a34a;font-size:18px;font-weight:900;">1</span>
                </td>
                <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;" width="100%">
                  <p style="margin:0 0 4px;color:#166534;font-size:13px;font-weight:800;">Submit Proof of Gate-OUT</p>
                  <p style="margin:0;color:#166534;font-size:12px;line-height:1.65;">
                    If the ${entityLabel.toLowerCase()} has already exited the port, log in and submit the Gate-OUT
                    transaction record. The Pass Section will verify and remove the charge if a valid exit transaction exists.
                  </p>
                </td>
              </tr>

              <!-- Option 2: Exception -->
              <tr>
                <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;vertical-align:top;width:32px;">
                  <span style="color:#1d4ed8;font-size:18px;font-weight:900;">2</span>
                </td>
                <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;" width="100%">
                  <p style="margin:0 0 4px;color:#1e3a8a;font-size:13px;font-weight:800;">Request an Exception</p>
                  <p style="margin:0;color:#1e3a8a;font-size:12px;line-height:1.65;">
                    If there are genuine circumstances, you may submit an exception request with a
                    supporting reason through the portal. The <strong>Traffic Department</strong> will review and
                    approve or reject the request. If approved, the applicable overstay charges will be waived.
                    If rejected, the charge must be paid before a new pass can be issued.
                  </p>
                </td>
              </tr>

            </table>

            <!-- ── CTA Buttons ── -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center" style="padding:4px 6px;">
                  <a href="${portalUrl}/dashboard/pass_request"
                    style="display:inline-block;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:13px;font-weight:700;margin:4px;">
                    View Pass Details →
                  </a>
                </td>
              </tr>
            </table>

            <!-- ── Footer Note ── -->
            <p style="margin:0;color:#94a3b8;font-size:11.5px;line-height:1.75;border-top:1px solid #e2e8f0;padding-top:18px;">
              This is an automated daily reminder sent by the Chennai Port Authority APACS system. <strong>Do not reply to this email.</strong><br/>
              For queries, contact the Pass Section at Chennai Port Authority directly.
            </p>
          </td>
        </tr>

        <!-- ── Email Footer ── -->
        <tr>
          <td style="background:#f8fafc;padding:14px 36px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">
              © ${new Date().getFullYear()} Chennai Port Authority &nbsp;·&nbsp; APACS &nbsp;·&nbsp; All rights reserved
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

module.exports = overstayReminderTemplate;
