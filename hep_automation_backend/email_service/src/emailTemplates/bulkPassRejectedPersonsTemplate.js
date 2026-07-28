/**
 * bulkPassRejectedPersonsTemplate.js
 *
 * Sent to the applicant when a batch is finalized (COMPLETED) but one or more
 * persons were individually rejected by the traffic officer.
 * Includes each rejected person's name and the reason given by the officer.
 *
 * Payload:
 *   { companyName, refNo, rejectedPersons: [{ name, aadhaar, rejectionReason }] }
 */
const bulkPassRejectedPersonsTemplate = ({ companyName, refNo, rejectedPersons = [] }) => {
  const rows = rejectedPersons
    .map(
      (p, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#fef2f2"}">
        <td style="padding:10px 14px; font-size:13px; border-bottom:1px solid #fecaca; font-weight:600; color:#1f2937;">
          ${p.name || "—"}
        </td>
        <td style="padding:10px 14px; font-size:13px; border-bottom:1px solid #fecaca; font-family:monospace; color:#475569;">
          ${p.aadhaar ? "XXXX XXXX " + String(p.aadhaar).slice(-4) : "—"}
        </td>
        <td style="padding:10px 14px; font-size:13px; border-bottom:1px solid #fecaca; color:#991b1b;">
          ${p.rejectionReason || "No reason provided"}
        </td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:680px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#dc2626,#f97316); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Some Persons Were Not Approved</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority — Traffic Department
      </p>
    </div>

    <div style="border:1px solid #fecaca; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || "Applicant"},</p>

      <p style="background:#fff7ed; padding:12px 16px; border-radius:6px; color:#9a3412; border-left:4px solid #f97316;">
        Your bulk pass application <strong>(${refNo})</strong> has been finalized. However,
        <strong>${rejectedPersons.length} person(s)</strong> listed below were
        <strong>not approved</strong> by the Traffic Officer. The approved persons are
        included in your pass — please see your separate approval email for the QR pass link.
      </p>

      <h3 style="margin-top:24px; font-size:14px; color:#7f1d1d;">Rejected Persons &amp; Reasons</h3>

      <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:8px; border-radius:6px; overflow:hidden;">
        <thead>
          <tr style="background:#fef2f2;">
            <th style="padding:10px 14px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#dc2626; border-bottom:2px solid #fecaca;">
              Name
            </th>
            <th style="padding:10px 14px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#dc2626; border-bottom:2px solid #fecaca;">
              Aadhaar (last 4)
            </th>
            <th style="padding:10px 14px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#dc2626; border-bottom:2px solid #fecaca;">
              Rejection Reason
            </th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="margin-top:24px; padding:16px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">
        <p style="margin:0; font-size:13px; color:#92400e;">
          <strong>What to do next:</strong>
        </p>
        <ul style="margin:8px 0 0 18px; padding:0; font-size:13px; color:#92400e;">
          <li>Contact the department officer who initiated this application for further assistance.</li>
          <li>If you believe the rejection is incorrect, reach out to Chennai Port Authority — Traffic Department.</li>
          <li>The approved persons can still use their QR pass for entry within the validity period.</li>
        </ul>
      </div>

      <table style="width:100%; margin-top:24px; font-size:14px; border-collapse:collapse; background:#f8fafc; border-radius:6px;">
        <tr>
          <td style="padding:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Reference Number</td>
          <td style="padding:12px; font-weight:600; border-bottom:1px solid #e2e8f0;">${refNo}</td>
        </tr>
        <tr>
          <td style="padding:12px; color:#64748b;">Persons Rejected</td>
          <td style="padding:12px; font-weight:600; color:#dc2626;">${rejectedPersons.length}</td>
        </tr>
      </table>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This email is auto-generated. Please do not reply. For assistance, contact Chennai Port Authority.
      </p>

      <p style="margin-top:24px;">Regards,<br/><strong>Chennai Port Authority</strong><br/>Traffic Department</p>
    </div>
  </div>
  `;
};

module.exports = bulkPassRejectedPersonsTemplate;
