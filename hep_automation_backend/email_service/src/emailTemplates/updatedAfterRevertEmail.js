module.exports = (name, referenceNumber) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#2563eb,#3b82f6); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Registration Updated</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority
      </p>
    </div>

    <div style="border:1px solid #eff6ff; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${name},</p>

      <p style="background:#eff6ff; padding:12px 16px; border-radius:6px; color:#2563eb; font-weight: 500;">
        Your agent/company registration request has been updated successfully and resubmitted for verification.
      </p>

      <table style="width:100%; margin-top:20px; font-size:14px; border-collapse:collapse; background:#f8fafc; border-radius:6px; overflow:hidden;">
        <tr>
          <td style="padding:12px; color:#64748b; border-bottom:1px solid #e2e8f0; width:35%;">Reference Number</td>
          <td style="padding:12px; font-weight:600; font-family:monospace; border-bottom:1px solid #e2e8f0;">${referenceNumber}</td>
        </tr>
        <tr>
          <td style="padding:12px; color:#64748b;">Current Status</td>
          <td style="padding:12px; font-weight:600; color:#2563eb;">PENDING APPROVAL</td>
        </tr>
      </table>

      <div style="margin-top:24px; padding:16px; background:#f0f9ff; border-radius:6px; border-left:4px solid #0284c7;">
        <p style="margin:0; font-size:13px; color:#0369a1;">
          <strong>What's Next?</strong>
        </p>
        <p style="margin:4px 0 0; font-size:13px; color:#0369a1; line-height:1.4;">
          The administrator will review your corrected information and documents. You will receive your secure login credentials via email as soon as the review is complete and approved.
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