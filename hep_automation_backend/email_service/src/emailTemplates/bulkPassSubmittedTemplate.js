const bulkPassSubmittedTemplate = ({
  companyName,
  refNo,
  personsCount,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#2563eb,#3b82f6); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Bulk Pass Submitted</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority
      </p>
    </div>

    <div style="border:1px solid #dbeafe; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || "Applicant"},</p>

      <p style="background:#eff6ff; padding:12px 16px; border-radius:6px; color:#1d4ed8;">
        Your bulk pass application has been <strong>successfully submitted</strong> and is now awaiting
        review by the department officer.
      </p>

      <table style="width:100%; margin-top:24px; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0; color:#64748b;">Reference Number</td>
          <td style="padding:6px 0; font-weight:600;">${refNo}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Persons Submitted</td>
          <td style="padding:6px 0; font-weight:600;">${personsCount || 0} person(s)</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Status</td>
          <td style="padding:6px 0; font-weight:600; color:#2563eb;">SUBMITTED</td>
        </tr>
      </table>

      <p style="margin-top:24px; font-size:13px; color:#475569;">
        You will receive another notification once the application is forwarded to the Traffic Department for approval.
      </p>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This email is auto-generated. Please do not reply. For assistance, contact Chennai Port Authority.
      </p>

      <p style="margin-top:24px;">Regards,<br/>Chennai Port Authority</p>
    </div>
  </div>
  `;
};

module.exports = bulkPassSubmittedTemplate;
