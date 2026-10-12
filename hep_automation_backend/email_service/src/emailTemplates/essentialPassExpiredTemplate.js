const { formatValidityDate } = require("../utils/formatDate");

/**
 * essentialPassExpiredTemplate.js
 *
 * Sent to the agent/pass holder when an Essential Pass Conversion period
 * concludes and the pass automatically reverts back to its standard Ordinary Pass status.
 */
const essentialPassExpiredTemplate = ({
  agentName,
  entityName,
  entityType = "person",
  passNo,
  referenceNo,
  conversionStartDate,
  conversionEndDate,
  originalPassValidUpto,
  reapplyLink,
}) => {
  const convStart = formatValidityDate(conversionStartDate);
  const convEnd = formatValidityDate(conversionEndDate);
  const baseValidUpto = formatValidityDate(originalPassValidUpto);
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
    <div style="background: linear-gradient(90deg, #d97706, #f59e0b); color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: left;">
      <div style="display:inline-block; background:rgba(255,255,255,0.2); padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
        Notice: Reverted to Ordinary
      </div>
      <h2 style="margin:0; font-size:20px; font-weight:700;">Chennai Port — Essential Pass Expired</h2>
      <p style="margin:6px 0 0; font-size:13px; opacity:0.9;">
        Pass Reverted to Standard Ordinary Status | Chennai Port Authority
      </p>
    </div>

    <!-- Main Card -->
    <div style="background: #ffffff; padding: 28px; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="margin-top:0; font-size:15px;">Dear <strong>${agentName || "Applicant"}</strong>,</p>

      <!-- Status Alert Box -->
      <div style="background: #fff7ed; border-left: 4px solid #ea580c; padding: 14px 16px; border-radius: 4px; margin: 18px 0;">
        <p style="margin: 0; color: #9a3412; font-size: 14px; font-weight: 500;">
          The temporary <strong>Essential Entry Permit</strong> period for <strong>${entityName || "your pass"}</strong> has concluded. This pass has now automatically <strong>reverted to an Ordinary Pass</strong>.
        </p>
      </div>

      <!-- Current Status Badge Display -->
      <div style="text-align: center; margin: 20px 0; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <span style="display: inline-block; background: #3b82f6; color: white; padding: 5px 14px; border-radius: 20px; font-weight: 700; font-size: 12px; letter-spacing: 0.5px;">
          ACTIVE PASS: ORDINARY PASS
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
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Essential Period (Ended)</td>
          <td style="padding: 10px 16px; font-weight: 600; font-size: 13px; color: #dc2626; border-bottom: 1px solid #e2e8f0;">
            ${convStart} to ${convEnd}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Current Category</td>
          <td style="padding: 10px 16px; font-weight: 700; font-size: 13px; color: #2563eb; border-bottom: 1px solid #e2e8f0;">
            ORDINARY PASS
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px;">Base Pass Valid Until</td>
          <td style="padding: 10px 16px; font-weight: 700; font-size: 13px; color: #1e293b;">
            ${baseValidUpto}
          </td>
        </tr>
      </table>

      <!-- Operational Guidelines Box -->
      <div style="margin-top: 24px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
        <p style="margin: 0; font-size: 13px; color: #334155; font-weight: 700;">
          What This Means:
        </p>
        <ul style="margin: 8px 0 0 18px; padding: 0; font-size: 12px; color: #475569; line-height: 1.6;">
          <li>The pass holder can continue entering the port under <strong>standard ordinary pass rules</strong> until ${baseValidUpto}.</li>
          <li>Special essential entry privileges (priority lanes / emergency jetty access) are no longer active.</li>
          <li>If an essential operational requirement arises again in the future, you may submit a fresh conversion requisition from your agent dashboard.</li>
        </ul>
      </div>

      ${reapplyLink
      ? `
      <!-- Action CTA -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="${reapplyLink}"
           style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
          Go to Agent Dashboard
        </a>
      </div>
      `
      : ""
    }

      <!-- Footer Signoff -->
      <p style="margin-top: 24px; font-size: 13px; color: #64748b;">
        This is an automated lifecycle notice. Please do not reply directly to this email.<br/>
        For assistance, contact <strong>Chennai Port Authority — Traffic Department</strong>.
      </p>

      <p style="margin-top: 20px; font-size: 14px; font-weight: 600; color: #0f172a;">
        Regards,<br/>
        <strong style="color: #d97706;">Chennai Port Authority</strong><br/>
        <span style="font-weight: 400; color: #475569;">HEP Automation Portal</span>
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

module.exports = essentialPassExpiredTemplate;
