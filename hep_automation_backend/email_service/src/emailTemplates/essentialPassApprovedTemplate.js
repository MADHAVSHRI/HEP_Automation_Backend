const { formatValidityDate } = require("../utils/formatDate");

/**
 * essentialPassApprovedTemplate.js
 *
 * Sent to the agent/pass holder when an Essential Pass Conversion request
 * receives final approval and is officially upgraded to an Essential Entry Permit.
 */
const essentialPassApprovedTemplate = ({
  agentName,
  entityName,
  entityType = "person",
  passNo,
  referenceNo,
  departmentName,
  validFrom,
  validUpto,
  qrLink,
}) => {
  const formattedValidFrom = formatValidityDate(validFrom);
  const formattedValidUpto = formatValidityDate(validUpto);
  const typeLabel =
    String(entityType).toLowerCase() === "vehicle" ? "Vehicle" : "Person";

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
    <div style="background: linear-gradient(90deg, #15803d, #16a34a); color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: left;">
      <div style="display:inline-block; background:rgba(255,255,255,0.2); padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
        Approved &amp; Active
      </div>
      <h2 style="margin:0; font-size:20px; font-weight:700;">Chennai Port — Essential Pass Approved</h2>
      <p style="margin:6px 0 0; font-size:13px; opacity:0.9;">
        Authorized by ${departmentName || "Chennai Port Authority — Traffic Department"}
      </p>
    </div>

    <!-- Main Card -->
    <div style="background: #ffffff; padding: 28px; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="margin-top:0; font-size:15px;">Dear <strong>${agentName || "Applicant"}</strong>,</p>

      <!-- Status Alert Box -->
      <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px 16px; border-radius: 4px; margin: 18px 0;">
        <p style="margin: 0; color: #15803d; font-size: 14px; font-weight: 500;">
          <strong>Congratulations!</strong> Your pass has been approved for <strong>Essential Entry Permit</strong> privileges. The designated pass holder is now authorized for essential/priority port access for the approved operational duration.
        </p>
      </div>

      <!-- Essential Badge Display -->
      <div style="text-align: center; margin: 20px 0; padding: 16px; background: #f8fafc; border: 2px dashed #86efac; border-radius: 8px;">
        <span style="display: inline-block; background: #16a34a; color: white; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">
          ★ ESSENTIAL ENTRY PERMIT ★
        </span>
        <div style="margin-top: 10px; font-size: 16px; font-weight: 700; color: #0f172a;">
          ${entityName || "Pass Holder"}
        </div>
        <div style="font-size: 13px; color: #64748b; font-family: monospace; margin-top: 4px;">
          Pass No: <strong style="color: #1e293b;">${passNo || "N/A"}</strong>
        </div>
      </div>

      <!-- Details Summary Table -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; width: 40%; border-bottom: 1px solid #e2e8f0;">Entity Type</td>
          <td style="padding: 10px 16px; font-weight: 600; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${typeLabel}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Application Ref No.</td>
          <td style="padding: 10px 16px; font-weight: 700; font-size: 14px; color: #0f172a; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${referenceNo}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Department</td>
          <td style="padding: 10px 16px; font-weight: 600; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${departmentName || "Traffic Department"}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Essential Valid From</td>
          <td style="padding: 10px 16px; font-weight: 700; font-size: 13px; color: #15803d; border-bottom: 1px solid #e2e8f0;">
            ${formattedValidFrom}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Essential Valid Until</td>
          <td style="padding: 10px 16px; font-weight: 700; font-size: 13px; color: #15803d; border-bottom: 1px solid #e2e8f0;">
            ${formattedValidUpto}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px;">Status</td>
          <td style="padding: 10px 16px; font-weight: 700; font-size: 13px; color: #16a34a;">
            ACTIVE ESSENTIAL PERMIT
          </td>
        </tr>
      </table>

      ${qrLink
      ? `
      <!-- Action CTA -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="${qrLink}"
           style="background: #16a34a; color: #ffffff; text-decoration: none; padding: 13px 26px; border-radius: 6px; font-weight: 700; font-size: 14px; display: inline-block;">
          View &amp; Download QR Pass
        </a>
      </div>
      `
      : ""
    }

      <!-- Operational Guidelines Box -->
      <div style="margin-top: 24px; padding: 16px; background: #fffbeb; border-radius: 6px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 700;">
          Important Instructions:
        </p>
        <ul style="margin: 8px 0 0 18px; padding: 0; font-size: 12px; color: #78350f; line-height: 1.6;">
          <li>Present the updated QR code at the port security gates for priority access scanning.</li>
          <li>This essential conversion is valid <strong>strictly until ${formattedValidUpto}</strong>.</li>
          <li>Upon expiry of this window, your pass will <strong>automatically revert to an Ordinary Pass</strong> without disrupting your original pass term.</li>
          <li>Pass credentials must not be transferred or shared with unapproved parties.</li>
        </ul>
      </div>

      <!-- Footer Signoff -->
      <p style="margin-top: 24px; font-size: 13px; color: #64748b;">
        This email is auto-generated by the APACS system. Please do not reply directly.<br/>
        For queries, contact <strong>Chennai Port Authority — Traffic Department</strong>.
      </p>

      <p style="margin-top: 20px; font-size: 14px; font-weight: 600; color: #0f172a;">
        Regards,<br/>
        <strong style="color: #16a34a;">Chennai Port Authority</strong><br/>
        <span style="font-weight: 400; color: #475569;">Traffic &amp; Marine Operations</span>
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

module.exports = essentialPassApprovedTemplate;
