/**
 * overstayReminderTemplate.js
 * Email template for OVERSTAY_REMINDER Kafka event.
 * Sent daily to agents with unpaid overstay charges.
 */
function overstayReminderTemplate({ company_name, identifier, entity_type, pass_no, date_to, overstay_days, total_amount, charge_id }) {
  const formattedDate = date_to ? new Date(date_to).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
  const formattedAmount = `₹${parseFloat(total_amount || 0).toLocaleString("en-IN")}`;

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
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0a1e4d 0%,#1a3a6e 100%);padding:28px 36px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.3px;">Chennai Port Authority</h1>
            <p style="margin:6px 0 0;color:#93b4e8;font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:1px;">APACS — Automated Port Access &amp; Control System</p>
          </td>
        </tr>

        <!-- Alert Banner -->
        <tr>
          <td style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px 36px;">
            <p style="margin:0;color:#dc2626;font-size:14px;font-weight:700;">⚠ URGENT: Unpaid Overstay Charge</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
              Dear <strong>${company_name || "Agent"}</strong>,
            </p>
            <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.7;">
              This is an official reminder from <strong>Chennai Port Authority — ATM / Pass Section</strong>.<br/>
              A pass holder associated with your company has exceeded their permitted entry period and an overstay charge has been levied. Failure to clear this charge will block future pass applications.
            </p>

            <!-- Charge Details Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#0a1e4d;">
                <td colspan="2" style="padding:12px 20px;">
                  <p style="margin:0;color:#ffffff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Overstay Charge Details — Ref #${charge_id}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:600;width:45%;">Entity Type</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:700;">${entity_type}</td>
              </tr>
              <tr style="background:#ffffff;">
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:600;">Identifier</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:700;">${identifier}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:600;">Pass Number</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:700;">${pass_no || "N/A"}</td>
              </tr>
              <tr style="background:#ffffff;">
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:600;">Pass Expiry Date</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:700;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:600;">Days Overstayed</td>
                <td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;color:#dc2626;font-size:13px;font-weight:800;">${overstay_days} day(s)</td>
              </tr>
              <tr style="background:#fef2f2;">
                <td style="padding:14px 20px;color:#64748b;font-size:13px;font-weight:600;">Total Amount Due</td>
                <td style="padding:14px 20px;color:#dc2626;font-size:20px;font-weight:900;">${formattedAmount}</td>
              </tr>
            </table>

            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.7;">
              Please log in to the <strong>APACS Agent Portal</strong>, navigate to <em>Blacklist &amp; Penalties → Overstay Charges</em>, and clear this charge immediately.
              You may also apply for an exception if circumstances warrant review.
            </p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 24px;">
                  <a href="http://localhost:3000/dashboard/blacklist_penalties" style="background:linear-gradient(135deg,#dc2626,#b91c1c);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;display:inline-block;">
                    Pay Overstay Charge Now →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#64748b;font-size:12px;line-height:1.7;border-top:1px solid #e2e8f0;padding-top:20px;">
              This is an automated reminder from the Chennai Port Authority APACS system. Do not reply to this email.<br/>
              For queries, contact the ATM / Pass Section at Chennai Port Authority.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 36px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">© ${new Date().getFullYear()} Chennai Port Authority · APACS · All rights reserved</p>
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
