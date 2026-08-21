const publicRequestRejectedTemplate = ({
  companyName,
  trackingNumber,
  rejectionReason,
  submissionDate,
  applicantEmail,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#dc2626,#ef4444); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">❌ Bulk Pass Request Rejected</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority — General Administrator
      </p>
    </div>

    <div style="border:1px solid #fecaca; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || "Applicant"},</p>

      <p style="background:#fee2e2; padding:12px 16px; border-radius:6px; color:#991b1b; font-size:15px;">
        We regret to inform you that your bulk pass request has been <strong>rejected</strong> by the General Administrator.
      </p>

      <table style="width:100%; margin-top:24px; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0; color:#64748b;">Tracking Number</td>
          <td style="padding:6px 0; font-weight:600;">${trackingNumber}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Applicant Email</td>
          <td style="padding:6px 0; font-weight:600;">${applicantEmail}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Submission Date</td>
          <td style="padding:6px 0; font-weight:600;">${submissionDate}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Status</td>
          <td style="padding:6px 0; font-weight:600; color:#dc2626;">✗ REJECTED</td>
        </tr>
      </table>

      <div style="margin-top:32px; padding:20px; background:#fef2f2; border-radius:8px; border:2px solid #dc2626;">
        <p style="margin:0 0 12px; font-size:15px; font-weight:600; color:#991b1b;">
          📋 Rejection Reason
        </p>
        <p style="margin:0; font-size:14px; color:#7f1d1d; background:#fff; padding:16px; border-radius:6px; border-left:4px solid #dc2626; line-height:1.6;">
          ${rejectionReason || "No reason provided."}
        </p>
      </div>

      <div style="margin-top:24px; padding:16px; background:#fef3c7; border-left:4px solid #f59e0b; border-radius:4px;">
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#92400e;">
          🔄 How to Address Issues and Reapply
        </p>
        <ol style="margin:8px 0 0; padding-left:20px; font-size:13px; color:#92400e; line-height:1.6;">
          <li style="margin-bottom:8px;">
            <strong>Review the Rejection Reason:</strong> Carefully read the reason provided above. Identify what documentation or information was incomplete or incorrect.
          </li>
          <li style="margin-bottom:8px;">
            <strong>Gather Required Documentation:</strong> If documents are missing or invalid (e.g., work order, company registration), obtain the correct documentation before reapplying.
          </li>
          <li style="margin-bottom:8px;">
            <strong>Correct Information:</strong> Ensure all company details, contact information, validity dates, and pass requirements are accurate and complete.
          </li>
          <li style="margin-bottom:8px;">
            <strong>Submit a New Request:</strong> Once you've addressed the issues, visit the public bulk pass request page to submit a new application with corrected information.
          </li>
          <li style="margin-bottom:8px;">
            <strong>Allow Processing Time:</strong> New requests typically receive a review decision within 2-3 business days.
          </li>
        </ol>
      </div>

      <div style="margin-top:24px; padding:20px; background:#eff6ff; border-radius:8px; border:1px solid #3b82f6;">
        <p style="margin:0 0 12px; font-size:15px; font-weight:600; color:#1e40af;">
          🔗 Submit a New Request
        </p>
        <p style="margin:0 0 16px; font-size:13px; color:#475569;">
          Ready to reapply? Click the button below to access the public bulk pass request form.
        </p>
        <p style="text-align:center; margin:0;">
          <a href="https://hep.chennaiport.gov.in/public/bulk-pass-request"
             style="background:#2563eb; color:#fff; text-decoration:none;
                    padding:14px 32px; border-radius:6px; font-weight:600;
                    display:inline-block; font-size:15px;">
            Submit New Bulk Pass Request
          </a>
        </p>
      </div>

      <div style="margin-top:24px; padding:16px; background:#f0fdf4; border-left:4px solid #16a34a; border-radius:4px;">
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#166534;">
          💡 Common Rejection Reasons & Solutions:
        </p>
        <table style="width:100%; margin-top:12px; font-size:13px; color:#166534; border-collapse:collapse; line-height:1.5;">
          <tr>
            <td style="padding:6px 0; vertical-align:top; width:40%;"><strong>Incomplete Documentation</strong></td>
            <td style="padding:6px 0; vertical-align:top;">Ensure all required documents (work order, company registration) are provided and valid.</td>
          </tr>
          <tr>
            <td style="padding:6px 0; vertical-align:top; padding-top:12px;"><strong>Invalid Validity Period</strong></td>
            <td style="padding:6px 0; vertical-align:top; padding-top:12px;">Check that validity dates are realistic and comply with port authority policies.</td>
          </tr>
          <tr>
            <td style="padding:6px 0; vertical-align:top; padding-top:12px;"><strong>Incorrect Company Information</strong></td>
            <td style="padding:6px 0; vertical-align:top; padding-top:12px;">Verify company name, registration details, and contact information are accurate.</td>
          </tr>
          <tr>
            <td style="padding:6px 0; vertical-align:top; padding-top:12px;"><strong>Insufficient Purpose Details</strong></td>
            <td style="padding:6px 0; vertical-align:top; padding-top:12px;">Provide clear and detailed explanation of the purpose for bulk pass requirement.</td>
          </tr>
          <tr>
            <td style="padding:6px 0; vertical-align:top; padding-top:12px;"><strong>Policy Violations</strong></td>
            <td style="padding:6px 0; vertical-align:top; padding-top:12px;">Ensure the request complies with Chennai Port Authority bulk pass policies and guidelines.</td>
          </tr>
        </table>
      </div>

      <div style="margin-top:32px; padding:16px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0;">
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#334155;">
          📞 Need Clarification or Want to Appeal?
        </p>
        <p style="margin:0; font-size:13px; color:#475569; line-height:1.6;">
          If you believe this rejection was made in error or need clarification on the rejection reason, you may contact the General Administrator's office for assistance:<br/><br/>
          <strong>General Administrator Department</strong><br/>
          Chennai Port Authority<br/>
          Email: <a href="mailto:admin@chennaiport.gov.in" style="color:#2563eb;">admin@chennaiport.gov.in</a><br/>
          Phone: +91-44-XXXX-XXXX<br/>
          Working Hours: 9:00 AM - 5:30 PM (Monday to Friday)
        </p>
        <p style="margin:12px 0 0; font-size:13px; color:#475569; line-height:1.6;">
          When contacting us, please reference your <strong>Tracking Number: ${trackingNumber}</strong> for faster assistance.
        </p>
      </div>

      <div style="margin-top:24px; padding:16px; background:#fef2f2; border-left:4px solid #ef4444; border-radius:4px;">
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#991b1b;">
          ⚠️ Important Information:
        </p>
        <ul style="margin:8px 0 0; padding-left:20px; font-size:13px; color:#991b1b; line-height:1.6;">
          <li style="margin-bottom:6px;">This rejection does <strong>not</strong> prevent you from submitting a new request with corrected information.</li>
          <li style="margin-bottom:6px;">Each new request will be reviewed independently based on its merits and compliance with port authority policies.</li>
          <li style="margin-bottom:6px;">There is no limit to the number of times you can reapply, but ensure all issues are addressed before resubmission.</li>
          <li style="margin-bottom:6px;">Appeals or clarifications should be directed to the General Administrator's office using the contact information above.</li>
        </ul>
      </div>

      <p style="margin-top:32px; font-size:12px; color:#94a3b8;">
        This email is auto-generated. Please do not reply. For assistance, use the contact information provided above. Save your tracking number (${trackingNumber}) for future reference.
      </p>

      <p style="margin-top:24px;">Regards,<br/><strong>General Administrator</strong><br/>Chennai Port Authority</p>
    </div>
  </div>
  `;
};

module.exports = publicRequestRejectedTemplate;
