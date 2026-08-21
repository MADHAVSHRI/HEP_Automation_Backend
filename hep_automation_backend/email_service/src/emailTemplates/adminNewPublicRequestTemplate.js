const adminNewPublicRequestTemplate = ({
  companyName,
  applicantEmail,
  applicantMobile,
  noOfPersons,
  noOfVehicles,
  validityFrom,
  validityUpto,
  visitorType,
  purpose,
  trackingNumber,
  requestDetailLink,
  submissionTimestamp,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#dc2626,#ef4444); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">🔔 New Public Bulk Pass Request</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority — General Administrator Action Required
      </p>
    </div>

    <div style="border:1px solid #fecaca; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear General Administrator,</p>

      <p style="background:#fef2f2; padding:12px 16px; border-radius:6px; color:#991b1b;">
        A new bulk pass request has been submitted via the public website and requires your <strong>urgent review and approval</strong>.
      </p>

      <div style="margin:24px 0; padding:16px; background:#fef3c7; border-left:4px solid #f59e0b; border-radius:4px;">
        <p style="margin:0; font-size:14px; color:#92400e;">
          <strong>⚡ Action Required:</strong> Please review and approve/reject this request within 2-3 business days.
        </p>
      </div>

      <h3 style="color:#dc2626; margin:24px 0 12px; font-size:16px; border-bottom:2px solid #fecaca; padding-bottom:8px;">
        📋 Request Details
      </h3>

      <table style="width:100%; margin-top:16px; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; width:45%;">Tracking Number</td>
          <td style="padding:8px 0; font-weight:600;">${trackingNumber}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b;">Submission Date & Time</td>
          <td style="padding:8px 0; font-weight:600;">${submissionTimestamp}</td>
        </tr>
        <tr style="background:#fef3f2;">
          <td style="padding:8px 0; color:#64748b;">Company Name</td>
          <td style="padding:8px 0; font-weight:700; color:#dc2626;">${companyName}</td>
        </tr>
      </table>

      <h3 style="color:#dc2626; margin:24px 0 12px; font-size:16px; border-bottom:2px solid #fecaca; padding-bottom:8px;">
        👤 Applicant Contact Information
      </h3>

      <table style="width:100%; margin-top:16px; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; width:45%;">Email Address</td>
          <td style="padding:8px 0; font-weight:600;">
            <a href="mailto:${applicantEmail}" style="color:#2563eb; text-decoration:none;">${applicantEmail}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b;">Mobile Number</td>
          <td style="padding:8px 0; font-weight:600;">
            <a href="tel:${applicantMobile}" style="color:#2563eb; text-decoration:none;">${applicantMobile}</a>
          </td>
        </tr>
      </table>

      <h3 style="color:#dc2626; margin:24px 0 12px; font-size:16px; border-bottom:2px solid #fecaca; padding-bottom:8px;">
        🎫 Pass Requirements
      </h3>

      <table style="width:100%; margin-top:16px; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; width:45%;">Visitor Type</td>
          <td style="padding:8px 0; font-weight:600;">${visitorType || "—"}</td>
        </tr>
        <tr style="background:#fef3f2;">
          <td style="padding:8px 0; color:#64748b;">Number of Persons</td>
          <td style="padding:8px 0; font-weight:700; color:#dc2626; font-size:16px;">${noOfPersons} person(s)</td>
        </tr>
        <tr style="background:#fef3f2;">
          <td style="padding:8px 0; color:#64748b;">Number of Vehicles</td>
          <td style="padding:8px 0; font-weight:700; color:#dc2626; font-size:16px;">${noOfVehicles} vehicle(s)</td>
        </tr>
      </table>

      <h3 style="color:#dc2626; margin:24px 0 12px; font-size:16px; border-bottom:2px solid #fecaca; padding-bottom:8px;">
        📅 Validity Period Requested
      </h3>

      <table style="width:100%; margin-top:16px; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; color:#64748b; width:45%;">Valid From</td>
          <td style="padding:8px 0; font-weight:600;">${validityFrom || "Not specified"}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b;">Valid Up To</td>
          <td style="padding:8px 0; font-weight:600;">${validityUpto}</td>
        </tr>
      </table>

      ${purpose ? `
      <h3 style="color:#dc2626; margin:24px 0 12px; font-size:16px; border-bottom:2px solid #fecaca; padding-bottom:8px;">
        📝 Purpose
      </h3>
      <p style="background:#f9fafb; padding:12px; border-radius:6px; font-size:13px; color:#374151; margin-top:12px;">
        ${purpose}
      </p>
      ` : ''}

      <div style="margin:32px 0; text-align:center;">
        <a href="${requestDetailLink}"
           style="background:#dc2626; color:#fff; text-decoration:none;
                  padding:14px 32px; border-radius:6px; font-weight:600;
                  display:inline-block; font-size:15px;">
          📂 Review & Approve Request
        </a>
      </div>

      <p style="font-size:13px; color:#475569; text-align:center;">
        If the button above doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="word-break:break-all; font-size:12px; text-align:center;">
        <a href="${requestDetailLink}" style="color:#2563eb;">${requestDetailLink}</a>
      </p>

      <div style="margin-top:24px; padding:16px; background:#fef3c7; border-left:4px solid #f59e0b; border-radius:4px;">
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#92400e;">
          ⏰ Urgency Notice:
        </p>
        <p style="margin:0; font-size:13px; color:#92400e;">
          Please review this request within 2-3 business days to maintain service quality. 
          The applicant is expecting a timely response.
        </p>
      </div>

      <div style="margin-top:24px; padding:16px; background:#eff6ff; border-left:4px solid #2563eb; border-radius:4px;">
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#1e40af;">
          📌 What Happens Next:
        </p>
        <ol style="margin:8px 0 0; padding-left:20px; font-size:13px; color:#1e40af;">
          <li style="margin-bottom:6px;">Click the "Review & Approve Request" button above to access the request details.</li>
          <li style="margin-bottom:6px;">Review the company information, pass requirements, and validity period.</li>
          <li style="margin-bottom:6px;">Choose to approve (set validity dates and send upload link) or reject (provide reason).</li>
          <li style="margin-bottom:6px;">The applicant will be notified via email of your decision.</li>
        </ol>
      </div>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This email is auto-generated. If you have questions about this request, contact the applicant directly using the contact information provided above.
      </p>

      <p style="margin-top:24px;">Regards,<br/>Chennai Port Authority System</p>
    </div>
  </div>
  `;
};

module.exports = adminNewPublicRequestTemplate;
