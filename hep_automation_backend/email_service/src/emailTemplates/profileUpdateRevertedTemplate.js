/**
 * Profile Update Reverted Email Template
 * Sent to the agent/company when their profile update request is reverted for corrections.
 */
const profileUpdateRevertedTemplate = (name, referenceNumber, reason) => {
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
    <div style="background: linear-gradient(90deg, #b45309, #d97706); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin:0; font-size:20px;">⚠️ Profile Update Action Required (Reverted)</h2>
      <p style="margin:6px 0 0; font-size:13px; opacity:0.9;">Chennai Port Authority — HEP Automation Portal</p>
    </div>

    <!-- Content Card -->
    <div style="background: #ffffff; padding: 28px; border: 1px solid #e5e7eb; border-top: none;">
      <p>Dear <strong>${name || "Company / Agent"}</strong>,</p>

      <p style="background:#fef3c7; padding:14px 16px; border-radius:6px; color:#92400e; border-left:4px solid #f59e0b; margin: 16px 0;">
        <strong>Your profile update request (Ref: ${referenceNumber}) has been reverted by the Traffic Pass Section for corrections.</strong><br/>
        Please review the official remarks below and resubmit the necessary changes.
      </p>

      <table style="width:100%; margin-top:20px; font-size:14px; border-collapse:collapse; background:#f9fafb; border-radius:6px; border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:12px 16px; color:#64748b; border-bottom:1px solid #e5e7eb; width:40%;">Reference Number</td>
          <td style="padding:12px 16px; font-weight:bold; border-bottom:1px solid #e5e7eb; color:#0a1e4d; font-family:monospace;">${referenceNumber}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px; color:#64748b;">Request Status</td>
          <td style="padding:12px 16px; font-weight:bold; color:#b45309;">REVERTED FOR CORRECTION</td>
        </tr>
      </table>

      <!-- Remarks Box -->
      <div style="background:#fffbeb; padding:18px; border-radius:6px; margin:24px 0; border:1px solid #fcd34d;">
        <strong style="color:#92400e; font-size:14px;">📌 Approver Remarks / Reason for Reversion:</strong>
        <p style="margin:8px 0 0; font-size:14px; color:#78350f; background:#ffffff; padding:12px; border-radius:4px; border:1px solid #fde68a;">
          ${reason || "Please verify your input details and ensure all supporting documents are valid and legible."}
        </p>
      </div>

      <!-- Resubmission Instructions -->
      <div style="background:#f8fafc; padding:16px; border-radius:6px; margin:24px 0; border-left:4px solid #d97706;">
        <strong style="color:#b45309;">How to resubmit?</strong>
        <ol style="margin:10px 0 0; padding-left:20px; color:#334155; font-size:13px;">
          <li>Log in to your agent portal account.</li>
          <li>Click on <strong>"Profile Settings"</strong> and click <strong>"Update Profile"</strong>.</li>
          <li>Make the required corrections and re-upload valid PDF documents if requested.</li>
          <li>Submit the form. Your existing reference number <strong>${referenceNumber}</strong> will be reused without creating duplicates.</li>
        </ol>
      </div>

      <div style="margin:28px 0; text-align:center;">
        <a href="http://localhost:3000/dashboard"
           style="background:#d97706; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:6px; font-weight:bold; display:inline-block; font-size:14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          Log In & Resubmit Request
        </a>
      </div>

      <p style="margin-top:24px;">Regards,<br/><strong>Chennai Port Authority</strong><br/>Traffic Department</p>
    </div>

    <!-- Footer -->
    <div style="background: #b45309; color: white; padding: 16px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
      <p style="margin:0;"><strong>Chennai Port Authority</strong><br/>HEP Automation Portal</p>
      <p style="margin-top:8px; font-size:11px; opacity:0.8;">This is an automated message. Please do not reply directly to this email.</p>
    </div>

  </div>
</body>
</html>
  `;
};

module.exports = profileUpdateRevertedTemplate;
