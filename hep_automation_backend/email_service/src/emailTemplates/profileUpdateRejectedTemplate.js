/**
 * Profile Update Rejected Email Template
 * Sent to the agent/company when their profile update request is rejected.
 */
const profileUpdateRejectedTemplate = (name, referenceNumber, reason) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin:0; padding:0; background:#f3f4f6;">
  <div style="max-width: 620px; margin: 0 auto; padding: 20px;">

    <!-- Header Banner -->
    <div style="background: linear-gradient(90deg, #991b1b, #dc2626); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin:0; font-size:20px;">❌ Profile Update Request Rejected</h2>
      <p style="margin:6px 0 0; font-size:13px; opacity:0.9;">Chennai Port Authority — HEP Automation Portal</p>
    </div>

    <!-- Content Card -->
    <div style="background: #ffffff; padding: 28px; border: 1px solid #e5e7eb; border-top: none;">
      <p>Dear <strong>${name || "Company / Agent"}</strong>,</p>

      <p style="background:#fee2e2; padding:14px 16px; border-radius:6px; color:#991b1b; border-left:4px solid #ef4444; margin: 16px 0;">
        <strong>Your profile update request (Ref: ${referenceNumber}) has been rejected by the Traffic Pass Section.</strong>
      </p>

      <table style="width:100%; margin-top:20px; font-size:14px; border-collapse:collapse; background:#f9fafb; border-radius:6px; border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:12px 16px; color:#64748b; border-bottom:1px solid #e5e7eb; width:40%;">Reference Number</td>
          <td style="padding:12px 16px; font-weight:bold; border-bottom:1px solid #e5e7eb; color:#0a1e4d; font-family:monospace;">${referenceNumber}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px; color:#64748b;">Request Status</td>
          <td style="padding:12px 16px; font-weight:bold; color:#dc2626;">REJECTED</td>
        </tr>
        <tr>
          <td style="padding:12px 16px; color:#64748b;">Processed By</td>
          <td style="padding:12px 16px; font-weight:bold; color:#1e293b;">Traffic Pass Section</td>
        </tr>
      </table>

      <!-- Reason Box -->
      <div style="background:#fef2f2; padding:18px; border-radius:6px; margin:24px 0; border:1px solid #fca5a5;">
        <strong style="color:#991b1b; font-size:14px;">📌 Official Reason for Rejection:</strong>
        <p style="margin:8px 0 0; font-size:14px; color:#7f1d1d; background:#ffffff; padding:12px; border-radius:4px; border:1px solid #fecaca;">
          ${reason || "The requested profile changes or supporting documents do not conform to Chennai Port Authority regulations."}
        </p>
      </div>

      <p style="font-size:13px; color:#6b7280; margin-top:24px;">
        For further clarification regarding this decision, please contact the Traffic Pass Section, Chennai Port Authority.
      </p>

      <p style="margin-top:24px;">Regards,<br/><strong>Chennai Port Authority</strong><br/>Traffic Department</p>
    </div>

    <!-- Footer -->
    <div style="background: #991b1b; color: white; padding: 16px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
      <p style="margin:0;"><strong>Chennai Port Authority</strong><br/>HEP Automation Portal</p>
      <p style="margin-top:8px; font-size:11px; opacity:0.8;">This is an automated message. Please do not reply directly to this email.</p>
    </div>

  </div>
</body>
</html>
  `;
};

module.exports = profileUpdateRejectedTemplate;
