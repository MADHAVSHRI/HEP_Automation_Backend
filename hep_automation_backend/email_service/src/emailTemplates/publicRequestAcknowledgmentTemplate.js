const publicRequestAcknowledgmentTemplate = ({
  companyName,
  trackingNumber,
  submissionTimestamp,
  applicantEmail,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#2563eb,#3b82f6); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Bulk Pass Request Received</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority
      </p>
    </div>

    <div style="border:1px solid #dbeafe; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || "Applicant"},</p>

      <p style="background:#eff6ff; padding:12px 16px; border-radius:6px; color:#1d4ed8;">
        Your bulk pass request has been <strong>successfully submitted</strong> and is now pending review by the General Administrator.
      </p>

      <table style="width:100%; margin-top:24px; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0; color:#64748b;">Tracking Number</td>
          <td style="padding:6px 0; font-weight:600;">${trackingNumber}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Submission Date & Time</td>
          <td style="padding:6px 0; font-weight:600;">${submissionTimestamp}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Applicant Email</td>
          <td style="padding:6px 0; font-weight:600;">${applicantEmail}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Status</td>
          <td style="padding:6px 0; font-weight:600; color:#f59e0b;">PENDING ADMIN APPROVAL</td>
        </tr>
      </table>

      <div style="margin-top:24px; padding:16px; background:#fef3c7; border-left:4px solid #f59e0b; border-radius:4px;">
        <p style="margin:0; font-size:14px; color:#92400e;">
          <strong>⏱ Estimated Review Time:</strong> 2-3 business days
        </p>
      </div>

      <div style="margin-top:24px; padding:16px; background:#f0fdf4; border-left:4px solid #16a34a; border-radius:4px;">
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#166534;">
          📋 Next Steps:
        </p>
        <ol style="margin:8px 0 0; padding-left:20px; font-size:13px; color:#166534;">
          <li style="margin-bottom:6px;">Our General Administrator will review your request within 2-3 business days.</li>
          <li style="margin-bottom:6px;">You will receive an email notification with the approval decision.</li>
          <li style="margin-bottom:6px;">If approved, you will receive a secure upload link to submit visitor and vehicle details.</li>
          <li style="margin-bottom:6px;">If rejected, the email will contain the reason and guidance for reapplication.</li>
        </ol>
      </div>

      <p style="margin-top:24px; font-size:13px; color:#475569;">
        Please save your <strong>Tracking Number (${trackingNumber})</strong> for future reference. You can use it to inquire about your request status.
      </p>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This email is auto-generated. Please do not reply. For assistance, contact Chennai Port Authority.
      </p>

      <p style="margin-top:24px;">Regards,<br/>Chennai Port Authority</p>
    </div>
  </div>
  `;
};

module.exports = publicRequestAcknowledgmentTemplate;
