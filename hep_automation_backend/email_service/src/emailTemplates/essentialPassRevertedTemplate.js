/**
 * essentialPassRevertedTemplate.js
 *
 * Sent to the agent/pass holder when an Essential Pass Conversion request
 * is reverted/returned for corrections by a department or the Pass Section.
 */
const essentialPassRevertedTemplate = ({
  agentName,
  entityName,
  entityType = "person",
  passNo,
  referenceNo,
  departmentName,
  revertingDepartment,
  revertReason,
  loginLink,
}) => {
  const typeLabel =
    String(entityType).toLowerCase() === "vehicle" ? "Vehicle" : "Person";
  const portalUrl =
    loginLink ||
    (process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL
      ? `${(process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL).replace(/\/$/, "")}/dashboard/pass_request`
      : "http://localhost:3000/dashboard/pass_request");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; margin:0; padding:0; background:#f1f5f9;">
  <div style="max-width: 620px; margin: 0 auto; padding: 24px 16px;">

    <!-- Header Banner -->
    <div style="background: linear-gradient(90deg, #d97706, #f59e0b); color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: left;">
      <div style="display:inline-block; background:rgba(255,255,255,0.2); padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
        Action Required: Reverted for Correction
      </div>
      <h2 style="margin:0; font-size:20px; font-weight:700;">Chennai Port — Essential Pass Conversion Reverted</h2>
      <p style="margin:6px 0 0; font-size:13px; opacity:0.9;">
        Automated Port Access Control System (APACS) | Chennai Port Authority
      </p>
    </div>

    <!-- Main Card -->
    <div style="background: #ffffff; padding: 28px; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="margin-top:0; font-size:15px;">Dear <strong>${agentName || "Applicant"}</strong>,</p>

      <!-- Status Alert Box -->
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 4px; margin: 18px 0;">
        <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 500;">
          Your Essential Pass Conversion application for <strong>${entityName || "your pass"}</strong> has been <strong>returned for correction</strong> by <strong>${revertingDepartment || departmentName || "the reviewing authority"}</strong>.
        </p>
      </div>

      <!-- Revert Reason Box -->
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin:0 0 6px; font-size:12px; font-weight:700; color:#b91c1c; text-transform:uppercase; letter-spacing:0.5px;">
          Reason for Reversion / Remarks:
        </p>
        <p style="margin:0; font-size:14px; font-weight:600; color:#991b1b; line-height:1.5;">
          ${revertReason || "No specific remarks provided. Please review the application details and submitted documents."}
        </p>
      </div>

      <!-- Application Details Table -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; width: 40%; border-bottom: 1px solid #e2e8f0;">Entity Type</td>
          <td style="padding: 10px 16px; font-weight: 600; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${typeLabel}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Entity Name / Registration</td>
          <td style="padding: 10px 16px; font-weight: 700; font-size: 13px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${entityName || "—"}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Pass Number</td>
          <td style="padding: 10px 16px; font-weight: 700; font-size: 13px; color: #1e293b; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${passNo || "—"}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Application Ref No.</td>
          <td style="padding: 10px 16px; font-weight: 700; font-size: 14px; color: #0f172a; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${referenceNo}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Target Department</td>
          <td style="padding: 10px 16px; font-weight: 600; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${departmentName || "Chennai Port Authority"}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Reviewing Authority</td>
          <td style="padding: 10px 16px; font-weight: 600; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${revertingDepartment || departmentName || "Department Officer"}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px;">Status</td>
          <td style="padding: 10px 16px; font-weight: 700; font-size: 13px; color: #d97706;">
            REVERTED FOR CORRECTION
          </td>
        </tr>
      </table>

      <!-- Next Steps Box -->
      <div style="background: #eff6ff; padding: 16px; border-radius: 6px; margin: 20px 0; border: 1px solid #bfdbfe;">
        <strong style="color: #1e40af; font-size: 13px;">How to proceed:</strong>
        <ol style="margin: 8px 0 0 18px; padding: 0; color: #1e40af; font-size: 13px; line-height: 1.6;">
          <li>Log in to the APACS Portal using your registered credentials.</li>
          <li>Locate your application <strong>${referenceNo}</strong> under Essential Conversion Passes.</li>
          <li>Rectify the details or re-upload the necessary documents as indicated above.</li>
          <li>Click <strong>Resubmit Application</strong> to send it back for review.</li>
        </ol>
      </div>

      <!-- Action CTA -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="${portalUrl}"
           style="background: #d97706; color: #ffffff; text-decoration: none; padding: 13px 26px; border-radius: 6px; font-weight: 700; font-size: 14px; display: inline-block;">
          Open Portal to Correct Application
        </a>
      </div>

      <!-- Footer Signoff -->
      <p style="margin-top: 24px; font-size: 13px; color: #64748b;">
        This is an automated system notification. Please do not reply directly to this email.<br/>
        For support, contact <strong>Chennai Port Authority — Traffic Department</strong>.
      </p>

      <p style="margin-top: 20px; font-size: 14px; font-weight: 600; color: #0f172a;">
        Regards,<br/>
        <strong style="color: #0f172a;">Chennai Port Authority</strong><br/>
        <span style="font-weight: 400; color: #475569;">Automated Port Access Control System (APACS)</span>
      </p>
    </div>

    <!-- Bottom Footer -->
    <div style="text-align: center; margin-top: 16px; font-size: 11px; color: #94a3b8;">
      © ${new Date().getFullYear()} Chennai Port Authority. All rights reserved.
    </div>

  </div>
</body>
</html>
  `;
};

module.exports = essentialPassRevertedTemplate;
