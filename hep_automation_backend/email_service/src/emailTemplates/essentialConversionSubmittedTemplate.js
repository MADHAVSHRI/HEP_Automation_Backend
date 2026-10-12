const { formatValidityDate } = require("../utils/formatDate");

/**
 * essentialConversionSubmittedTemplate.js
 *
 * Sent to the agent/company when an Essential Pass Conversion request
 * is submitted and queued for department review.
 */
const essentialConversionSubmittedTemplate = ({
  agentName,
  referenceNo,
  departmentName,
  purpose,
  conversionStartDate,
  conversionEndDate,
  items = [],
  itemsCount = 0,
}) => {
  const convStart = formatValidityDate(conversionStartDate);
  const convEnd = formatValidityDate(conversionEndDate);
  const count = itemsCount || (Array.isArray(items) ? items.length : 0);

  // Render items rows if provided
  let entityRows = "";
  if (Array.isArray(items) && items.length > 0) {
    entityRows = items
      .slice(0, 10)
      .map((item, idx) => {
        const typeLabel =
          item.entityType === "vehicle" ? "Vehicle" : "Person";
        const nameOrReg =
          item.name || item.registrationNo || item.entityLabel || `Entity #${idx + 1}`;
        const passNum =
          item.passNo || item.personPassNo || item.vehiclePassNo || "—";
        return `
          <tr>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">
              <span style="display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:#e0f2fe; color:#0369a1;">
                ${typeLabel.toUpperCase()}
              </span>
            </td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:600; color:#1e293b;">
              ${nameOrReg}
            </td>
            <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; font-size:13px; font-family:monospace; color:#334155;">
              ${passNum}
            </td>
          </tr>
        `;
      })
      .join("");

    if (items.length > 10) {
      entityRows += `
        <tr>
          <td colspan="3" style="padding:10px 12px; font-size:12px; color:#64748b; text-align:center; background:#f8fafc;">
            ... and ${items.length - 10} more pass(es) included in this request.
          </td>
        </tr>
      `;
    }
  }

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
    <div style="background: linear-gradient(90deg, #1d4ed8, #3b82f6); color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: left;">
      <h2 style="margin:0; font-size:20px; font-weight:700;">Chennai Port — Essential Pass Conversion Request</h2>
      <p style="margin:6px 0 0; font-size:13px; opacity:0.9;">
        c | Chennai Port Authority
      </p>
    </div>

    <!-- Main Card -->
    <div style="background: #ffffff; padding: 28px; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="margin-top:0; font-size:15px;">Dear <strong>${agentName || "Agent / Applicant"}</strong>,</p>

      <!-- Status Alert Box -->
      <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 14px 16px; border-radius: 4px; margin: 18px 0;">
        <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 500;">
          Your request to convert Ordinary Pass(es) to <strong>Essential Entry Permit</strong> status has been <strong>successfully submitted</strong> and is currently under departmental review.
        </p>
      </div>

      <!-- Request Overview Table -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; width: 40%; border-bottom: 1px solid #e2e8f0;">Application Ref No.</td>
          <td style="padding: 10px 16px; font-weight: 700; font-size: 14px; color: #0f172a; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${referenceNo}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Requesting Department</td>
          <td style="padding: 10px 16px; font-weight: 600; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${departmentName || "Port Operations"}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Requested Duration</td>
          <td style="padding: 10px 16px; font-weight: 600; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">
            ${convStart} to ${convEnd}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Total Passes Selected</td>
          <td style="padding: 10px 16px; font-weight: 700; font-size: 13px; color: #2563eb; border-bottom: 1px solid #e2e8f0;">${count} Pass(es)</td>
        </tr>
        ${
          purpose
            ? `<tr>
                <td style="padding: 10px 16px; color: #64748b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Purpose of Conversion</td>
                <td style="padding: 10px 16px; font-size: 13px; color: #334155; border-bottom: 1px solid #e2e8f0;">${purpose}</td>
              </tr>`
            : ""
        }
        <tr>
          <td style="padding: 10px 16px; color: #64748b; font-size: 13px;">Workflow Status</td>
          <td style="padding: 10px 16px; font-weight: 700; font-size: 13px; color: #d97706;">
            PENDING DEPARTMENT REVIEW
          </td>
        </tr>
      </table>

      ${
        entityRows
          ? `
      <!-- Converted Entities Breakdown -->
      <div style="margin-top: 24px;">
        <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
          Passes Included in Request (${count})
        </h4>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 8px 12px; font-size: 12px; color: #475569; font-weight: 600; border-bottom: 1px solid #cbd5e1;">Type</th>
              <th style="padding: 8px 12px; font-size: 12px; color: #475569; font-weight: 600; border-bottom: 1px solid #cbd5e1;">Name / Reg No</th>
              <th style="padding: 8px 12px; font-size: 12px; color: #475569; font-weight: 600; border-bottom: 1px solid #cbd5e1;">Pass No</th>
            </tr>
          </thead>
          <tbody>
            ${entityRows}
          </tbody>
        </table>
      </div>
      `
          : ""
      }

      <!-- Next Steps & Info Box -->
      <div style="margin-top: 24px; padding: 14px 16px; background: #fffbeb; border-radius: 6px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 600;">Next Steps:</p>
        <p style="margin: 6px 0 0; font-size: 12px; color: #78350f; line-height: 1.5;">
          The designated department officers will examine the requisition letter and verify the operational requirement. You will receive an automated confirmation email once the final approval is granted by the Traffic Department.
        </p>
      </div>

      <!-- Footer Signoff -->
      <p style="margin-top: 24px; font-size: 13px; color: #64748b;">
        This is an automated system notification. Please do not reply directly to this email.<br/>
        For support, contact <strong>Chennai Port Authority — Traffic Department</strong>.
      </p>

      <p style="margin-top: 20px; font-size: 14px; font-weight: 600; color: #0f172a;">
        Regards,<br/>
        <span style="font-weight: 400; color: #475569;">Chennai Port Authority — HEP Portal</span>
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

module.exports = essentialConversionSubmittedTemplate;
