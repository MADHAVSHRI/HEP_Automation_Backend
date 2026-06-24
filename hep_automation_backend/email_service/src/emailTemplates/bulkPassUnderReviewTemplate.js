const bulkPassUnderReviewTemplate = ({
  companyName,
  refNo,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#d97706,#f59e0b); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Bulk Pass Under Review</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority — Traffic Department
      </p>
    </div>

    <div style="border:1px solid #fde7d2; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || "Applicant"},</p>

      <p style="background:#fffbeb; padding:12px 16px; border-radius:6px; color:#92400e;">
        Your bulk pass application has been forwarded to the <strong>Traffic Department</strong> and is
        currently <strong>under review</strong>. You will be notified once a decision has been made.
      </p>

      <table style="width:100%; margin-top:24px; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0; color:#64748b;">Reference Number</td>
          <td style="padding:6px 0; font-weight:600;">${refNo}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Status</td>
          <td style="padding:6px 0; font-weight:600; color:#d97706;">UNDER REVIEW</td>
        </tr>
      </table>

      <p style="margin-top:24px; font-size:13px; color:#475569;">
        No further action is required from you at this time.
      </p>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This email is auto-generated. Please do not reply. For assistance, contact Chennai Port Authority.
      </p>

      <p style="margin-top:24px;">Regards,<br/>Chennai Port Authority</p>
    </div>
  </div>
  `;
};

module.exports = bulkPassUnderReviewTemplate;
