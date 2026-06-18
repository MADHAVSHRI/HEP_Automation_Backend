const agentApprovalTemplate = (name, loginId, password) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#16a34a,#22c55e); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Registration Approved</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority
      </p>
    </div>

    <div style="border:1px solid #dcfce7; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${name},</p>

      <p style="background:#dcfce7; padding:12px 16px; border-radius:6px; color:#16a34a; font-weight: 500;">
        <strong>Congratulations!</strong> Your agent/company registration request has been <strong>approved</strong>. You can now login to the HEP Automation Portal.
      </p>

      <p style="font-size:14px; margin-top:20px; font-weight:bold; color:#374151;">Your Credentials:</p>
      <table style="width:100%; font-size:14px; border-collapse:collapse; background:#f8fafc; border-radius:6px; overflow:hidden;">
        <tr>
          <td style="padding:12px; color:#64748b; border-bottom:1px solid #e2e8f0;">Login ID</td>
          <td style="padding:12px; font-weight:600; font-family:monospace; border-bottom:1px solid #e2e8f0;">${loginId}</td>
        </tr>
        <tr>
          <td style="padding:12px; color:#64748b;">Password</td>
          <td style="padding:12px; font-weight:600; font-family:monospace;">${password}</td>
        </tr>
      </table>

      <p style="margin:24px 0; text-align:center;">
        <a href="http://localhost:3000"
           style="background:#16a34a; color:#fff; text-decoration:none;
                  padding:12px 24px; border-radius:6px; font-weight:600;
                  display:inline-block; font-size:14px;">
          Login to Portal
        </a>
      </p>

      <div style="margin-top:24px; padding:16px; background:#fffbeb; border-radius:6px; border-left:4px solid #f59e0b;">
        <p style="margin:0; font-size:13px; color:#b45309;">
          <strong>Security Notice:</strong>
        </p>
        <p style="margin:4px 0 0; font-size:13px; color:#b45309;">
          For security reasons, you will be required to change your password immediately upon your first login.
        </p>
      </div>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This is an automated message. Please do not reply directly to this email.
      </p>

      <p style="margin-top:24px;">Regards,<br/><strong>Chennai Port Authority</strong></p>
    </div>
  </div>
  `;
};

module.exports = agentApprovalTemplate;