const vendorPassApprovedTemplate = ({
  companyName,
  referenceNo,
  qrLink,
  approvedPersonsCount,
  approvedVehiclesCount,
  validUpto,
  departmentName,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#16a34a,#22c55e); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Vendor Pass Approved</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Approved by ${departmentName || "Chennai Port Authority"}
      </p>
    </div>

    <div style="border:1px solid #dcfce7; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || "Vendor"},</p>

      <p style="background:#dcfce7; padding:12px 16px; border-radius:6px; color:#166534;">
        <strong>Great news!</strong> Your vendor pass application has been <strong>APPROVED</strong>.
        You can now view and download your QR codes for entry/exit at Chennai Port.
      </p>

      <p style="margin:24px 0; text-align:center;">
        <a href="${qrLink}"
           style="background:#16a34a; color:#fff; text-decoration:none;
                  padding:14px 28px; border-radius:6px; font-weight:600;
                  display:inline-block; font-size:15px;">
          View Your Pass QR Codes
        </a>
      </p>

      <p style="font-size:13px; color:#475569;">
        If the button doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="word-break:break-all; font-size:13px; background:#f1f5f9; padding:10px; border-radius:4px;">
        <a href="${qrLink}" style="color:#2563eb;">${qrLink}</a>
      </p>

      <table style="width:100%; margin-top:24px; font-size:14px; border-collapse:collapse; background:#f8fafc; border-radius:6px;">
        <tr>
          <td style="padding:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Reference Number</td>
          <td style="padding:12px; font-weight:600; border-bottom:1px solid #e2e8f0;">${referenceNo}</td>
        </tr>
        <tr>
          <td style="padding:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Approved Persons</td>
          <td style="padding:12px; font-weight:600; border-bottom:1px solid #e2e8f0;">${approvedPersonsCount} person(s)</td>
        </tr>
        <tr>
          <td style="padding:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Approved Vehicles</td>
          <td style="padding:12px; font-weight:600; border-bottom:1px solid #e2e8f0;">${approvedVehiclesCount} vehicle(s)</td>
        </tr>
        <tr>
          <td style="padding:12px; color:#64748b;">Valid Until</td>
          <td style="padding:12px; font-weight:600;">${validUpto || "As per individual pass validity"}</td>
        </tr>
      </table>

      <div style="margin-top:24px; padding:16px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">
        <p style="margin:0; font-size:13px; color:#92400e;">
          <strong>Important Instructions:</strong>
        </p>
        <ul style="margin:8px 0 0 18px; padding:0; font-size:13px; color:#92400e;">
          <li>Show your QR code at the gate for scanning</li>
          <li>Each QR code is unique and linked to your pass</li>
          <li>QR codes are valid only for the approved date range</li>
          <li>Keep your QR codes confidential</li>
        </ul>
      </div>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This email is auto-generated. Please do not reply. For assistance, contact Chennai Port Authority.
      </p>

      <p style="margin-top:24px;">Regards,<br/><strong>Chennai Port Authority</strong><br/>Traffic Department</p>
    </div>
  </div>
  `;
};

module.exports = vendorPassApprovedTemplate;
