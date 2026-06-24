const bulkPassApprovedTemplate = ({
  companyName,
  refNo,
  validityFrom,
  validityUpto,
  departmentName,
  qrLink,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#16a34a,#22c55e); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Bulk Pass Approved</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Approved by ${departmentName || "Chennai Port Authority — Traffic Department"}
      </p>
    </div>

    <div style="border:1px solid #bbf7d0; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || "Applicant"},</p>

      <p style="background:#dcfce7; padding:12px 16px; border-radius:6px; color:#15803d;">
        <strong>Congratulations!</strong> Your bulk pass application has been <strong>APPROVED</strong> by the
        Traffic Department. Use the button below to view and download your QR pass.
      </p>

      ${qrLink ? `
      <p style="margin:24px 0; text-align:center;">
        <a href="${qrLink}"
           style="background:#16a34a; color:#fff; text-decoration:none;
                  padding:14px 28px; border-radius:6px; font-weight:600;
                  display:inline-block; font-size:15px;">
          View &amp; Download Your QR Pass
        </a>
      </p>
      <p style="font-size:13px; color:#475569;">
        If the button doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="word-break:break-all; font-size:13px; background:#f1f5f9; padding:10px; border-radius:4px;">
        <a href="${qrLink}" style="color:#2563eb;">${qrLink}</a>
      </p>
      ` : ""}

      <table style="width:100%; margin-top:24px; font-size:14px; border-collapse:collapse; background:#f8fafc; border-radius:6px;">
        <tr>
          <td style="padding:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Reference Number</td>
          <td style="padding:12px; font-weight:600; border-bottom:1px solid #e2e8f0;">${refNo}</td>
        </tr>
        <tr>
          <td style="padding:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Status</td>
          <td style="padding:12px; font-weight:600; color:#16a34a; border-bottom:1px solid #e2e8f0;">APPROVED</td>
        </tr>
        <tr>
          <td style="padding:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Valid From</td>
          <td style="padding:12px; font-weight:600; border-bottom:1px solid #e2e8f0;">${validityFrom || "—"}</td>
        </tr>
        <tr>
          <td style="padding:12px; color:#64748b;">Valid Until</td>
          <td style="padding:12px; font-weight:600;">${validityUpto || "—"}</td>
        </tr>
      </table>

      <div style="margin-top:24px; padding:16px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">
        <p style="margin:0; font-size:13px; color:#92400e;">
          <strong>Important Instructions:</strong>
        </p>
        <ul style="margin:8px 0 0 18px; padding:0; font-size:13px; color:#92400e;">
          <li>Show your QR pass document at the gate for scanning</li>
          <li>The QR code is valid only for the approved date range</li>
          <li>Keep your pass document confidential</li>
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

module.exports = bulkPassApprovedTemplate;
