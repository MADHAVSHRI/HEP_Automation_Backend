module.exports = function passRejectedTemplate(
  nameOrPayload,
  referenceNumberArg,
  rejectedEntitiesArg,
  rejectedCountArg,
  portalLinkArg
) {
  let name;
  let referenceNumber;
  let rejectedEntities;
  let portalLink;

  if (typeof nameOrPayload === "object" && nameOrPayload !== null) {
    name = nameOrPayload.name || nameOrPayload.agentName || "Applicant";
    referenceNumber = nameOrPayload.referenceNumber || nameOrPayload.referenceNo || "—";
    rejectedEntities = nameOrPayload.rejectedEntities || [];
    portalLink = nameOrPayload.portalLink || nameOrPayload.portalUrl;
  } else {
    name = nameOrPayload || "Applicant";
    referenceNumber = referenceNumberArg || "—";
    rejectedEntities = rejectedEntitiesArg || [];
    portalLink = portalLinkArg;
  }

  const frontendBaseUrl =
    portalLink ||
    `${process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/pass_request`;

  const persons = (rejectedEntities || []).filter((e) => e.type === "person");
  const vehicles = (rejectedEntities || []).filter((e) => e.type === "vehicle");
  const totalCount = (rejectedEntities || []).length;

  const tableStyle =
    "width:100%; border-collapse:collapse; font-size:13px; margin-bottom:20px;";
  const thStyle =
    "background:#dc2626; color:#fff; padding:8px 12px; text-align:left; font-weight:bold;";
  const tdStyle =
    "padding:8px 12px; border-bottom:1px solid #fee2e2; vertical-align:top;";
  const tdAltStyle =
    "padding:8px 12px; border-bottom:1px solid #fee2e2; vertical-align:top; background:#fef2f2;";

  const buildTable = (rows, columns) => {
    if (!rows || rows.length === 0) return "";
    const header = `<tr>${columns
      .map((c) => `<th style="${thStyle}">${c}</th>`)
      .join("")}</tr>`;
    const body = rows
      .map(
        (row, i) =>
          `<tr>${row
            .map(
              (cell) =>
                `<td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${cell}</td>`
            )
            .join("")}</tr>`
      )
      .join("");
    return `<table style="${tableStyle}"><thead>${header}</thead><tbody>${body}</tbody></table>`;
  };

  const personsSection =
    persons.length > 0
      ? `<h4 style="margin:16px 0 6px; color:#374151; font-size:13px;">
          👤 Rejected Person Passes (${persons.length})
         </h4>
         ${buildTable(
        persons.map((p, i) => [
          `${i + 1}`,
          p.name || "—",
          p.reason || "Application rejected",
        ]),
        ["#", "Person Name", "Reason for Rejection"]
      )}`
      : "";

  const vehiclesSection =
    vehicles.length > 0
      ? `<h4 style="margin:16px 0 6px; color:#374151; font-size:13px;">
          🚗 Rejected Vehicle Passes (${vehicles.length})
         </h4>
         ${buildTable(
        vehicles.map((v, i) => [
          `${i + 1}`,
          v.name || "—",
          v.reason || "Application rejected",
        ]),
        ["#", "Registration No.", "Reason for Rejection"]
      )}`
      : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin:0; padding:0; background:#f3f4f6;">
  <div style="max-width: 620px; margin: 0 auto; padding: 20px;">
    
    <div style="background: #dc2626; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin:0; font-size:20px;">❌ Pass Application Entry Rejected</h2>
      <p style="margin:6px 0 0; font-size:13px; opacity:0.9;">Chennai Port Authority — Automated Port Access Control System (APACS)</p>
    </div>
    
    <div style="background: #f9fafb; padding: 28px; border: 1px solid #e5e7eb; border-top: none;">
      <p>Dear <strong>${name}</strong>,</p>
      
      <p>Your pass application with reference number <strong style="color: #dc2626; font-size: 16px;">${referenceNumber}</strong> has been reviewed. A total of <strong>${totalCount}</strong> ${totalCount === 1 ? "entry was" : "entries were"
    } <strong style="color:#dc2626;">not approved</strong> by the Approving Authority.</p>
      
      <div style="background: #fef2f2; padding: 14px 16px; border-left: 4px solid #dc2626; margin: 20px 0; border-radius: 0 6px 6px 0;">
        <strong style="color:#991b1b;">🚫 Rejection Details:</strong> The following ${totalCount === 1 ? "entry has" : "entries have"
    } been rejected with the stated remarks:
      </div>
      
      <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #fecaca; margin: 16px 0;">
        ${personsSection}
        ${vehiclesSection}
      </div>
      
      <div style="background: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <strong style="color: #1e40af;">Next Steps:</strong>
        <ol style="margin: 10px 0; padding-left: 20px; color: #1e40af;">
          <li>Log in to your HEP Automation Portal</li>
          <li>Navigate to <strong>Dashboard → Pass Request</strong></li>
          <li>Check application <strong>${referenceNumber}</strong> details</li>
          <li>For any approved entries in the same application, download your QR pass directly from the portal</li>
        </ol>
      </div>
      
      <p style="text-align: center;">
        <a href="${frontendBaseUrl}" style="display:inline-block; background:#dc2626; color:white; padding:12px 30px; text-decoration:none; border-radius:6px; font-weight:bold; margin:20px 0;">Go to Dashboard</a>
      </p>
      
      <p style="font-size: 13px; color: #6b7280; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <strong>Note:</strong> Rejected entries cannot be edited or resubmitted under the same reference number. If you still require port entry for rejected persons or vehicles, please submit a new pass application with the required corrections.
      </p>
    </div>
    
    <div style="background: #1e3a8a; color: white; padding: 16px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
      <p style="margin:0;"><strong>Chennai Port Authority</strong><br/>Automated Port Access Control System (APACS)</p>
      <p style="margin-top: 8px; font-size: 11px; opacity: 0.8;">This is an automated message. Please do not reply to this email.</p>
    </div>
    
  </div>
</body>
</html>
`;
};
