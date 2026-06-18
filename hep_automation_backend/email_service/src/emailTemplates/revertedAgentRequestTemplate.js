module.exports = (name, referenceNumber, reason) => {
  const editLink = `http://localhost:3000/register?ref=${referenceNumber}`;
  
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#ea580c,#f97316); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Registration Reverted</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Traffic Department
      </p>
    </div>

    <div style="border:1px solid #ffedd5; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${name},</p>

      <p style="background:#fff7ed; padding:12px 16px; border-radius:6px; color:#ea580c; font-weight: 500; border-left: 4px solid #f97316;">
        <strong>Action Required:</strong> Your agent/company registration request has been <strong>reverted</strong> by the Traffic Administrator for clarification or correction.
      </p>

      <table style="width:100%; margin-top:20px; font-size:14px; border-collapse:collapse; background:#f8fafc; border-radius:6px; overflow:hidden;">
        <tr>
          <td style="padding:12px; color:#64748b; border-bottom:1px solid #e2e8f0; width:35%;">Reference Number</td>
          <td style="padding:12px; font-weight:600; font-family:monospace; border-bottom:1px solid #e2e8f0;">${referenceNumber}</td>
        </tr>
        <tr>
          <td style="padding:12px; color:#64748b; vertical-align:top;">Required Clarifications</td>
          <td style="padding:12px; font-weight:600; color:#374151; line-height:1.5;">${reason}</td>
        </tr>
      </table>

      <p style="margin:24px 0; text-align:center;">
        <a href="${editLink}"
           style="background:#ea580c; color:#fff; text-decoration:none;
                  padding:12px 24px; border-radius:6px; font-weight:600;
                  display:inline-block; font-size:14px;">
          Update & Resubmit Registration
        </a>
      </p>

      <div style="margin-top:24px; padding:16px; background:#f0f9ff; border-radius:6px; border-left:4px solid #0284c7;">
        <p style="margin:0; font-size:13px; color:#0369a1;">
          <strong>Next Steps:</strong>
        </p>
        <p style="margin:4px 0 0; font-size:13px; color:#0369a1; line-height:1.4;">
          Click the link above to review your application form. Update the fields or upload the documents requested by the administrator, then submit it back for approval.
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