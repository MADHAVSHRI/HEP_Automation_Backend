const vendorPassLinkTemplate = ({
  companyName,
  referenceNo,
  link,
  validUpto,
  departmentName,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#f97316,#f59e0b); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Vendor Pass Application</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Issued by ${departmentName || "Chennai Port Authority"}
      </p>
    </div>

    <div style="border:1px solid #fde7d2; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || "Vendor"},</p>

      <p>
        ${departmentName || "Chennai Port"} has initiated a vendor pass application
        on your behalf. Please use the secure link below to fill in the pass
        details (persons / vehicles) and submit your application.
      </p>

      <p style="margin:24px 0; text-align:center;">
        <a href="${link}"
           style="background:#f97316; color:#fff; text-decoration:none;
                  padding:12px 24px; border-radius:6px; font-weight:600;
                  display:inline-block;">
          Open Vendor Pass Form
        </a>
      </p>

      <p style="font-size:13px; color:#475569;">
        If the button above doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="word-break:break-all; font-size:13px;">
        <a href="${link}" style="color:#2563eb;">${link}</a>
      </p>

      <table style="width:100%; margin-top:24px; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0; color:#64748b;">Reference</td>
          <td style="padding:6px 0; font-weight:600;">${referenceNo}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Valid up to</td>
          <td style="padding:6px 0; font-weight:600;">${validUpto}</td>
        </tr>
      </table>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This link is unique to your application. Do not forward it. Once
        submitted, it cannot be used again. If you did not expect this email,
        please ignore it.
      </p>

      <p style="margin-top:24px;">Regards,<br/>Chennai Port Authority</p>
    </div>
  </div>
  `;
};

module.exports = vendorPassLinkTemplate;
