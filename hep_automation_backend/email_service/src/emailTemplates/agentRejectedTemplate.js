const agentRejectionTemplate = (name, referenceNumber, reason) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#dc2626,#ef4444); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Registration Rejected</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority
      </p>
    </div>

    <div style="border:1px solid #fee2e2; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${name},</p>

      <p style="background:#fee2e2; padding:12px 16px; border-radius:6px; color:#b91c1c; font-weight: 500;">
        We regret to inform you that your agent/company registration request has been <strong>rejected</strong>.
      </p>

      <table style="width:100%; margin-top:20px; font-size:14px; border-collapse:collapse; background:#f8fafc; border-radius:6px; overflow:hidden;">
        <tr>
          <td style="padding:12px; color:#64748b; border-bottom:1px solid #e2e8f0; width:35%;">Reference Number</td>
          <td style="padding:12px; font-weight:600; font-family:monospace; border-bottom:1px solid #e2e8f0;">${referenceNumber}</td>
        </tr>
        <tr>
          <td style="padding:12px; color:#64748b; vertical-align:top;">Reason for Rejection</td>
          <td style="padding:12px; font-weight:600; color:#374151; line-height:1.5;">${reason}</td>
        </tr>
      </table>

      <div style="margin-top:24px; padding:16px; background:#fffbeb; border-radius:6px; border-left:4px solid #f59e0b;">
        <p style="margin:0; font-size:13px; color:#b45309;">
          <strong>What should I do?</strong>
        </p>
        <p style="margin:4px 0 0; font-size:13px; color:#b45309; line-height:1.4;">
          Please review the reason for rejection above. You may submit a new registration application after correcting the specified issues.
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

module.exports = agentRejectionTemplate;