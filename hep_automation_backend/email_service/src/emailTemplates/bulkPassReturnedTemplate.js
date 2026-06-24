const bulkPassReturnedTemplate = ({
  companyName,
  refNo,
  returnReason,
  uploadLink,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#ea580c,#f97316); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Action Required: Bulk Pass Returned</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority
      </p>
    </div>

    <div style="border:1px solid #fed7aa; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || "Applicant"},</p>

      <p style="background:#fff7ed; padding:12px 16px; border-radius:6px; color:#9a3412;">
        <strong>Action Required:</strong> Your bulk pass application has been <strong>returned</strong> by the
        department officer. Please review the reason below and re-upload the corrected Excel file(s).
      </p>

      ${returnReason ? `
      <div style="margin-top:16px; padding:16px; background:#fef2f2; border-radius:6px; border-left:4px solid #ef4444;">
        <p style="margin:0; font-size:13px; color:#7f1d1d;"><strong>Return Reason:</strong></p>
        <p style="margin:6px 0 0; font-size:14px; color:#991b1b;">${returnReason}</p>
      </div>
      ` : ""}

      <p style="margin:24px 0; text-align:center;">
        <a href="${uploadLink}"
           style="background:#ea580c; color:#fff; text-decoration:none;
                  padding:12px 24px; border-radius:6px; font-weight:600;
                  display:inline-block;">
          Re-upload Corrected Data
        </a>
      </p>

      <p style="font-size:13px; color:#475569;">
        If the button above doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="word-break:break-all; font-size:13px;">
        <a href="${uploadLink}" style="color:#2563eb;">${uploadLink}</a>
      </p>

      <table style="width:100%; margin-top:24px; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0; color:#64748b;">Reference Number</td>
          <td style="padding:6px 0; font-weight:600;">${refNo}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Status</td>
          <td style="padding:6px 0; font-weight:600; color:#ea580c;">RETURNED TO APPLICANT</td>
        </tr>
      </table>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This link is unique to your application. Once resubmitted, it cannot be used again.
        If you did not expect this email, please ignore it.
      </p>

      <p style="margin-top:24px;">Regards,<br/>Chennai Port Authority</p>
    </div>
  </div>
  `;
};

module.exports = bulkPassReturnedTemplate;
