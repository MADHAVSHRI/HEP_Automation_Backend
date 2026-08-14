/**
 * overstayLeviedTemplate.js
 * Email template for OVERSTAY_LEVIED Kafka event.
 * Sent once, at the moment ATM levies a new overstay charge on an agent.
 */
function overstayLeviedTemplate({
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
  <title>Overstay Fine Levied — Chennai Port APACS</title>
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

        <!-- ── Alert Banner ── -->
        <tr>
          <td style="background:#fef2f2;border-left:5px solid #dc2626;padding:14px 36px;">
            <p style="margin:0;color:#dc2626;font-size:14px;font-weight:800;">
              ⚠ NOTICE: Overstay Fine Levied
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
              This is an official notice from the <strong>Chennai Port Authority — ATM / Pass Section.</strong>
              An overstay fine has been levied against the pass details below, following expiry of the associated
              Harbour Entry Pass (HEP).
            </p>

            <!-- ── Charge Summary Card ── -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:26px;">
              <tr style="background:#0a1e4d;">
                <td colspan="2" style="padding:11px 20px;">
                  <p style="margin:0;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.1px;">
                    Overstay Charge Details — Charge Ref #${charge_id}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:11px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:600;width:44%;">Entity Type</td>
                <td style="padding:11px 20px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:700;">${entityLabel}</td>
              </tr>
              <tr style="background:#ffffff;">
                <td style="padding:11px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:600;">Identifier</td>
                <td style="padding:11px 20px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:700;font-family:monospace;">${identifier}</td>
              </tr>
              <tr>
                <td style="padding:11px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:600;">Pass Number</td>
                <td style="padding:11px 20px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:700;">${pass_no || "N/A"}</td>
              </tr>
              <tr style="background:#ffffff;">
                <td style="padding:11px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:600;">Pass Expiry Date</td>
                <td style="padding:11px 20px;border-bottom:1px solid #e2e8f0;color:#dc2626;font-size:13px;font-weight:700;">${formattedExpiry}</td>
              </tr>
              <tr>
                <td style="padding:11px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:600;">Days Overstayed</td>
                <td style="padding:11px 20px;border-bottom:1px solid #e2e8f0;color:#dc2626;font-size:13px;font-weight:800;">${overstay_days} day(s)</td>
              </tr>
              ${
                formattedDailyRate
                  ? `<tr style="background:#ffffff;">
                <td style="padding:11px 20px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:600;">Daily Penalty Rate</td>
                <td style="padding:11px 20px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:700;">${formattedDailyRate} / day</td>
              </tr>`
                  : ""
              }
              <tr style="background:#fef2f2;">
                <td style="padding:14px 20px;color:#64748b;font-size:13px;font-weight:700;">Total Amount Levied</td>
                <td style="padding:14px 20px;color:#dc2626;font-size:22px;font-weight:900;">${formattedTotal}</td>
              </tr>
            </table>

            <!-- ── Next Steps ── -->
            <p style="margin:0 0 12px;color:#0f172a;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">
              Next Steps
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-collapse:separate;border-spacing:0 8px;">
              <tr>
                <td style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;vertical-align:top;width:32px;">
                  <span style="color:#dc2626;font-size:18px;font-weight:900;">1</span>
                </td>
                <td style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;" width="100%">
                  <p style="margin:0 0 4px;color:#991b1b;font-size:13px;font-weight:800;">Pay the Overstay Penalty</p>
                  <p style="margin:0;color:#991b1b;font-size:12px;line-height:1.65;">
                    Log in to the APACS Agent Portal, navigate to <em>Blacklist &amp; Penalties → Overstay Charges</em>,
                    and clear the outstanding amount of <strong>${formattedTotal}</strong>. Unpaid overstay charges
                    will block future pass applications.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;vertical-align:top;width:32px;">
                  <span style="color:#1d4ed8;font-size:18px;font-weight:900;">2</span>
                </td>
                <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;" width="100%">
                  <p style="margin:0 0 4px;color:#1e3a8a;font-size:13px;font-weight:800;">Request an Exception</p>
                  <p style="margin:0;color:#1e3a8a;font-size:12px;line-height:1.65;">
                    If there are genuine extenuating circumstances, submit an exception request with a supporting
                    reason through the portal. The Traffic Department will review and decide.
                  </p>
                </td>
              </tr>
            </table>

            <!-- ── CTA ── -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center" style="padding:4px 6px;">
                  <a href="${portalUrl}/dashboard/blacklist_penalties"
                    style="display:inline-block;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:13px;font-weight:700;margin:4px;">
                    Pay Charge Now →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#94a3b8;font-size:11.5px;line-height:1.75;border-top:1px solid #e2e8f0;padding-top:18px;">
              This is an automated notice sent by the Chennai Port Authority APACS system. <strong>Do not reply to this email.</strong><br/>
              For queries, contact the ATM / Pass Section at Chennai Port Authority directly.
            </p>
          </td>
        </tr>

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

module.exports = overstayLeviedTemplate;