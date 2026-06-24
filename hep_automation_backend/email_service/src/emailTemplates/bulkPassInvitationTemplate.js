const bulkPassInvitationTemplate = ({
  companyName,
  refNo,
  visitorType,
  noOfPersons,
  noOfVehicles,
  validityFrom,
  validityUpto,
  uploadLink,
  departmentName,
  linkValidityHours,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#f97316,#f59e0b); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Bulk Pass Application</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Issued by ${departmentName || "Chennai Port Authority"}
      </p>
    </div>

    <div style="border:1px solid #fde7d2; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || "Applicant"},</p>

      <p>
        ${departmentName || "Chennai Port"} has initiated a bulk pass application on your behalf.
        Please use the secure link below to upload the required Excel file(s) with person and vehicle details.
      </p>

      <p style="margin:24px 0; text-align:center;">
        <a href="${uploadLink}"
           style="background:#f97316; color:#fff; text-decoration:none;
                  padding:12px 24px; border-radius:6px; font-weight:600;
                  display:inline-block;">
          Upload Bulk Pass Data
        </a>
      </p>

      <p style="font-size:13px; color:#475569;">
        If the button above doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="word-break:break-all; font-size:13px;">
        <a href="${uploadLink}" style="color:#2563eb;">${uploadLink}</a>
      </p>

      <table style="width:100%; margin-top:24px; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0; color:#64748b;">Reference Number</td>
          <td style="padding:6px 0; font-weight:600;">${refNo}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Visitor Type</td>
          <td style="padding:6px 0; font-weight:600;">${visitorType || "—"}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">No. of Persons</td>
          <td style="padding:6px 0; font-weight:600;">${noOfPersons || 0}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">No. of Vehicles</td>
          <td style="padding:6px 0; font-weight:600;">${noOfVehicles || 0}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Valid From</td>
          <td style="padding:6px 0; font-weight:600;">${validityFrom || "—"}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Valid Up To</td>
          <td style="padding:6px 0; font-weight:600;">${validityUpto || "—"}</td>
        </tr>
      </table>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This link is unique to your application. Do not forward it. Once submitted, it cannot be used again.
        ${linkValidityHours ? `For security, this link is valid for <strong>${linkValidityHours} hours</strong> from the time of issue.` : ""}
        If you did not expect this email, please ignore it.
      </p>

      <p style="margin-top:24px;">Regards,<br/>Chennai Port Authority</p>
    </div>
  </div>
  `;
};

module.exports = bulkPassInvitationTemplate;
