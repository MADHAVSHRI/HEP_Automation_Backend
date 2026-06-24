const bulkPassRejectedTemplate = ({
  companyName,
  refNo,
  rejectionReason,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#dc2626,#ef4444); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Bulk Pass Rejected</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority — Traffic Department
      </p>
    </div>

    <div style="border:1px solid #fecaca; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || "Applicant"},</p>

      <p style="background:#fef2f2; padding:12px 16px; border-radius:6px; color:#991b1b;">
        We regret to inform you that your bulk pass application has been <strong>REJECTED</strong> by the
        Traffic Department. Please review the reason below.
      </p>

      ${rejectionReason ? `
      <div style="margin-top:16px; padding:16px; background:#fef2f2; border-radius:6px; border-left:4px solid #dc2626;">
        <p style="margin:0; font-size:13px; color:#7f1d1d;"><strong>Rejection Reason:</strong></p>
        <p style="margin:6px 0 0; font-size:14px; color:#991b1b;">${rejectionReason}</p>
      </div>
      ` : ""}

      <table style="width:100%; margin-top:24px; font-size:14px; border-collapse:collapse; background:#f8fafc; border-radius:6px;">
        <tr>
          <td style="padding:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Reference Number</td>
          <td style="padding:12px; font-weight:600; border-bottom:1px solid #e2e8f0;">${refNo}</td>
        </tr>
        <tr>
          <td style="padding:12px; color:#64748b;">Status</td>
          <td style="padding:12px; font-weight:600; color:#dc2626;">REJECTED</td>
        </tr>
      </table>

      <p style="margin-top:24px; font-size:13px; color:#475569;">
        If you believe this decision is incorrect or wish to reapply, please contact the department officer
        who initiated this application for further assistance.
      </p>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This email is auto-generated. Please do not reply. For assistance, contact Chennai Port Authority.
      </p>

      <p style="margin-top:24px;">Regards,<br/><strong>Chennai Port Authority</strong><br/>Traffic Department</p>
    </div>
  </div>
  `;
};

module.exports = bulkPassRejectedTemplate;
