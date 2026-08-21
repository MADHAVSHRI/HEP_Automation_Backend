const childBatchConfirmationTemplate = ({
  companyName,
  refNo,
  submissionNumber,
  personsCount,
  vehiclesCount,
  parentRefNo,
  parentCompanyName,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#2563eb,#3b82f6); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Submission Confirmation</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority
      </p>
    </div>

    <div style="border:1px solid #dbeafe; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || parentCompanyName || "Applicant"},</p>

      <p style="background:#eff6ff; padding:12px 16px; border-radius:6px; color:#1d4ed8;">
        Your submission has been <strong>successfully received</strong> and is now under review by the 
        Traffic Department.
      </p>

      <div style="background:#f8fafc; padding:16px; border-radius:6px; margin-top:20px; border-left:4px solid #2563eb;">
        <h3 style="margin:0 0 12px 0; font-size:15px; color:#2563eb;">Submission Details</h3>
        <table style="width:100%; font-size:14px; border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0; color:#64748b;">Submission Number</td>
            <td style="padding:6px 0; font-weight:600; color:#2563eb;">#${submissionNumber}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748b;">Reference Number</td>
            <td style="padding:6px 0; font-weight:600;">${refNo}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748b;">Persons Submitted</td>
            <td style="padding:6px 0; font-weight:600;">${personsCount || 0} person(s)</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748b;">Vehicles Submitted</td>
            <td style="padding:6px 0; font-weight:600;">${vehiclesCount || 0} vehicle(s)</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748b;">Status</td>
            <td style="padding:6px 0; font-weight:600; color:#f59e0b;">UNDER REVIEW</td>
          </tr>
        </table>
      </div>

      ${parentRefNo ? `
      <div style="background:#fefce8; padding:12px 16px; border-radius:6px; margin-top:16px; border-left:4px solid #eab308;">
        <p style="margin:0; font-size:13px; color:#854d0e;">
          <strong>Parent Batch:</strong> ${parentRefNo} ${parentCompanyName ? `(${parentCompanyName})` : ''}
        </p>
      </div>
      ` : ''}

      <div style="background:#f1f5f9; padding:14px 16px; border-radius:6px; margin-top:20px;">
        <p style="margin:0; font-size:13px; color:#475569;">
          <strong>What happens next?</strong>
        </p>
        <ul style="margin:8px 0 0 0; padding-left:20px; font-size:13px; color:#64748b;">
          <li>Traffic Department will review each person and vehicle individually</li>
          <li>You will receive approval notifications once the review is complete</li>
          <li>Approved passes will be available for download via email</li>
        </ul>
      </div>

      <p style="margin-top:24px; font-size:13px; color:#475569;">
        You can continue to submit additional batches using the same link until your validity period expires.
      </p>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This email is auto-generated. Please do not reply. For assistance, contact Chennai Port Authority.
      </p>

      <p style="margin-top:24px;">Regards,<br/>Chennai Port Authority</p>
    </div>
  </div>
  `;
};

module.exports = childBatchConfirmationTemplate;
