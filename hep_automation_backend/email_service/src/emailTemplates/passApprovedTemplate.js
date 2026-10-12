const { formatValidityDate } = require("../utils/formatDate");

const passApprovedTemplate = ({
  agentName,
  referenceNo,
  approvedPersons = [],
  approvedVehicles = [],
  portalLink,
  notes,
}) => {
  const personsCount = approvedPersons.length;
  const vehiclesCount = approvedVehicles.length;

  const tableHeaderStyle = "padding:8px 12px; background:#f1f5f9; color:#475569; font-weight:600; font-size:12px; text-align:left; border-bottom:1px solid #e2e8f0;";
  const tableCellStyle = "padding:8px 12px; color:#1e293b; font-size:13px; border-bottom:1px solid #f1f5f9;";

  const personsSection =
    personsCount > 0
      ? `
      <h4 style="margin:20px 0 8px; color:#1e293b; font-size:14px;">
        👤 Approved Person Passes (${personsCount})
      </h4>
      <table style="width:100%; border-collapse:collapse; background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; font-size:13px;">
        <thead>
          <tr>
            <th style="${tableHeaderStyle}">#</th>
            <th style="${tableHeaderStyle}">Name</th>
            <th style="${tableHeaderStyle}">Pass No</th>
            <th style="${tableHeaderStyle}">Designation</th>
            <th style="${tableHeaderStyle}">Valid Upto</th>
          </tr>
        </thead>
        <tbody>
          ${approvedPersons
        .map(
          (p, i) => `
            <tr>
              <td style="${tableCellStyle}">${i + 1}</td>
              <td style="${tableCellStyle}; font-weight:600;">${p.name || "—"}</td>
              <td style="${tableCellStyle}; font-family:monospace; color:#0369a1;">${p.personPassNo || p.passNo || "—"}</td>
              <td style="${tableCellStyle}">${p.designation || p.designationName || "—"}</td>
              <td style="${tableCellStyle}">${p.validUpto ? formatValidityDate(p.validUpto) : "—"}</td>
            </tr>
          `
        )
        .join("")}
        </tbody>
      </table>
    `
      : "";

  const vehiclesSection =
    vehiclesCount > 0
      ? `
      <h4 style="margin:20px 0 8px; color:#1e293b; font-size:14px;">
        🚗 Approved Vehicle Passes (${vehiclesCount})
      </h4>
      <table style="width:100%; border-collapse:collapse; background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; font-size:13px;">
        <thead>
          <tr>
            <th style="${tableHeaderStyle}">#</th>
            <th style="${tableHeaderStyle}">Registration No</th>
            <th style="${tableHeaderStyle}">Pass No</th>
            <th style="${tableHeaderStyle}">Vehicle Type</th>
            <th style="${tableHeaderStyle}">Valid Upto</th>
          </tr>
        </thead>
        <tbody>
          ${approvedVehicles
        .map(
          (v, i) => `
            <tr>
              <td style="${tableCellStyle}">${i + 1}</td>
              <td style="${tableCellStyle}; font-weight:600;">${v.registrationNo || v.regNo || "—"}</td>
              <td style="${tableCellStyle}; font-family:monospace; color:#0369a1;">${v.vehiclePassNo || v.passNo || "—"}</td>
              <td style="${tableCellStyle}">${v.vehicleType || v.vehicleTypeName || "—"}</td>
              <td style="${tableCellStyle}">${v.validUpto ? formatValidityDate(v.validUpto) : "—"}</td>
            </tr>
          `
        )
        .join("")}
        </tbody>
      </table>
    `
      : "";

  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg, #16a34a, #22c55e); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0; font-size:20px;">✅ Chennai Port — Pass Approved</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Automated Port Access Control System (APACS) Automation System
      </p>
    </div>

    <div style="border:1px solid #bbf7d0; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear <strong>${agentName || "Applicant"}</strong>,</p>

      <p style="background:#dcfce7; padding:12px 16px; border-radius:6px; color:#15803d; border-left:4px solid #16a34a;">
        <strong>Great news!</strong> Passes in your application have been <strong>APPROVED</strong> by Chennai Port Authority. Digital QR passes are active and ready for download.
      </p>

      <table style="width:100%; margin-top:16px; font-size:14px; border-collapse:collapse; background:#f8fafc; border-radius:6px; overflow:hidden;">
        <tr>
          <td style="padding:10px 12px; color:#64748b; border-bottom:1px solid #e2e8f0; width:40%;">Reference Number</td>
          <td style="padding:10px 12px; font-weight:600; font-family:monospace; border-bottom:1px solid #e2e8f0; color:#0a1e4d;">${referenceNo}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Approved Persons</td>
          <td style="padding:10px 12px; font-weight:600; border-bottom:1px solid #e2e8f0; color:#16a34a;">${personsCount} person pass${personsCount === 1 ? "" : "es"}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px; color:#64748b;">Approved Vehicles</td>
          <td style="padding:10px 12px; font-weight:600; color:#16a34a;">${vehiclesCount} vehicle pass${vehiclesCount === 1 ? "" : "es"}</td>
        </tr>
      </table>

      ${personsSection}
      ${vehiclesSection}

      ${notes
      ? `
      <div style="margin-top:16px; padding:12px; background:#fffbeb; border-radius:6px; border-left:4px solid #f59e0b;">
        <p style="margin:0; font-size:13px; color:#92400e;"><strong>Note:</strong> ${notes}</p>
      </div>
      `
      : ""
    }

      <p style="margin:24px 0; text-align:center;">
        <a href="${portalLink || "http://localhost:3000/dashboard/pass_request"}"
           style="background:#16a34a; color:#fff; text-decoration:none;
                  padding:14px 28px; border-radius:6px; font-weight:600;
                  display:inline-block; font-size:15px;">
          View Approved Passes in Portal
        </a>
      </p>
      <p style="font-size:12px; color:#64748b; text-align:center;">
        You can also log in to your Agent Portal and navigate to "My Pass Requests" to download the digital QR codes.
      </p>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This is an automated message. Please carry the digital or printed QR pass during port entry and exit.
      </p>

      <p style="margin-top:20px;">Regards,<br/><strong>Chennai Port Authority</strong></p>
    </div>
  </div>
  `;
};

module.exports = passApprovedTemplate;
