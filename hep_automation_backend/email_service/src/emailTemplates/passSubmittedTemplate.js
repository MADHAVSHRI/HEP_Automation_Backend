const { formatDateTime } = require("../utils/formatDate");

const passSubmittedTemplate = ({
  agentName,
  referenceNo,
  personsCount = 0,
  vehiclesCount = 0,
  submissionDate,
  portalLink,
}) => {
  const formattedDate = formatDateTime(submissionDate);

  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg, #0a1e4d, #1e3a8a); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0; font-size:20px;">✅ Chennai Port — Pass Application Submitted</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Automated Port Access Control System (APACS) Automation System
      </p>
    </div>

    <div style="border:1px solid #e2e8f0; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear <strong>${agentName || "Applicant"}</strong>,</p>

      <p style="background:#eff6ff; padding:12px 16px; border-radius:6px; color:#1e40af; border-left:4px solid #2563eb;">
        Your pass application has been <strong>successfully submitted</strong> and is now pending review by Chennai Port Authority.
      </p>

      <p style="font-size:14px; margin-top:20px; font-weight:bold; color:#374151;">Application Details:</p>
      <table style="width:100%; font-size:14px; border-collapse:collapse; background:#f8fafc; border-radius:6px; overflow:hidden;">
        <tr>
          <td style="padding:10px 12px; color:#64748b; border-bottom:1px solid #e2e8f0; width:40%;">Reference Number</td>
          <td style="padding:10px 12px; font-weight:600; font-family:monospace; border-bottom:1px solid #e2e8f0; color:#0a1e4d;">${referenceNo}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Submission Date & Time</td>
          <td style="padding:10px 12px; font-weight:600; border-bottom:1px solid #e2e8f0;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Person Passes</td>
          <td style="padding:10px 12px; font-weight:600; border-bottom:1px solid #e2e8f0;">${personsCount} person pass${personsCount === 1 ? "" : "es"}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Vehicle Passes</td>
          <td style="padding:10px 12px; font-weight:600; border-bottom:1px solid #e2e8f0;">${vehiclesCount} vehicle pass${vehiclesCount === 1 ? "" : "es"}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px; color:#64748b;">Status</td>
          <td style="padding:10px 12px; font-weight:bold; color:#d97706;">PENDING REVIEW</td>
        </tr>
      </table>

      <div style="margin-top:24px; padding:16px; background:#f0fdf4; border-radius:6px; border-left:4px solid #16a34a;">
        <p style="margin:0; font-size:13px; font-weight:bold; color:#166534;">
          📋 Next Steps:
        </p>
        <p style="margin:4px 0 0; font-size:13px; color:#166534; line-height:1.5;">
          Your application will be verified by the Pass Section and designated port authorities. You will receive email notifications as each pass is approved or if any corrections are requested.
        </p>
      </div>

      <p style="margin:24px 0; text-align:center;">
        <a href="${portalLink || "http://localhost:3000/dashboard/pass_request"}"
           style="background:#0a1e4d; color:#fff; text-decoration:none;
                  padding:12px 24px; border-radius:6px; font-weight:600;
                  display:inline-block; font-size:14px;">
          Track Application Status
        </a>
      </p>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This is an automated message. Please keep your reference number for future communication.
      </p>

      <p style="margin-top:24px;">Regards,<br/><strong>Chennai Port Authority</strong></p>
    </div>
  </div>
  `;
};

module.exports = passSubmittedTemplate;
