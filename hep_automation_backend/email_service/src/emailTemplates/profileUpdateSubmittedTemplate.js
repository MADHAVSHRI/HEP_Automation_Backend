/**
 * Profile Update Submitted Email Template
 * Sent to the agent/company when they submit a profile change request.
 */
const profileUpdateSubmittedTemplate = (name, referenceNumber) => {
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
    <div style="background: linear-gradient(90deg, #0a1e4d, #1e3a8a); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin:0; font-size:20px;">📝 Profile Update Request Received</h2>
      <p style="margin:6px 0 0; font-size:13px; opacity:0.9;">Chennai Port Authority — HEP Automation Portal</p>
    </div>

    <!-- Content Card -->
    <div style="background: #ffffff; padding: 28px; border: 1px solid #e5e7eb; border-top: none;">
      <p>Dear <strong>${name || "Company / Agent"}</strong>,</p>

      <p style="background:#eff6ff; padding:14px 16px; border-radius:6px; color:#1e40af; border-left:4px solid #2563eb; margin: 16px 0;">
        <strong>Your profile update request has been successfully submitted.</strong><br/>
        Our Traffic Pass Section is now reviewing the updated details and supporting documents.
      </p>

      <table style="width:100%; margin-top:20px; font-size:14px; border-collapse:collapse; background:#f9fafb; border-radius:6px; border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:12px 16px; color:#64748b; border-bottom:1px solid #e5e7eb; width:40%;">Reference Number</td>
          <td style="padding:12px 16px; font-weight:bold; border-bottom:1px solid #e5e7eb; color:#0a1e4d; font-family:monospace;">${referenceNumber}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px; color:#64748b; border-bottom:1px solid #e5e7eb;">Request Status</td>
          <td style="padding:12px 16px; font-weight:bold; border-bottom:1px solid #e5e7eb; color:#d97706;">UNDER REVIEW</td>
        </tr>
        <tr>
          <td style="padding:12px 16px; color:#64748b;">Reviewing Department</td>
          <td style="padding:12px 16px; font-weight:bold; color:#1e293b;">Traffic Pass Section</td>
        </tr>
      </table>

      <!-- Next Steps -->
      <div style="background:#f8fafc; padding:16px; border-radius:6px; margin:24px 0; border-left:4px solid #0284c7;">
        <strong style="color:#0369a1;">What happens next?</strong>
        <ol style="margin:10px 0 0; padding-left:20px; color:#334155; font-size:13px;">
          <li>Traffic Department officials will verify your requested field changes and uploaded supporting documents.</li>
          <li>Once approved, your company profile will automatically be updated across the HEP portal.</li>
          <li>If any corrections are required, you will receive a notification email with detailed instructions to resubmit.</li>
        </ol>
      </div>

      <p style="font-size:13px; color:#6b7280; margin-top:24px;">
        Please keep your reference number <strong>${referenceNumber}</strong> handy for tracking your request.
      </p>

      <p style="margin-top:24px;">Regards,<br/><strong>Chennai Port Authority</strong><br/>Traffic Department</p>
    </div>

    <!-- Footer -->
    <div style="background: #1e3a8a; color: white; padding: 16px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
      <p style="margin:0;"><strong>Chennai Port Authority</strong><br/>HEP Automation Portal</p>
      <p style="margin-top:8px; font-size:11px; opacity:0.8;">This is an automated message. Please do not reply directly to this email.</p>
    </div>

  </div>
</body>
</html>
  `;
};

module.exports = profileUpdateSubmittedTemplate;
