const publicRequestApprovedTemplate = ({
  companyName,
  trackingNumber,
  uploadLink,
  validityFrom,
  validityUpto,
  noOfPersons,
  noOfVehicles,
  remarks,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#16a34a,#22c55e); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">✅ Bulk Pass Request Approved</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority — General Administrator
      </p>
    </div>

    <div style="border:1px solid #d1fae5; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || "Applicant"},</p>

      <p style="background:#dcfce7; padding:12px 16px; border-radius:6px; color:#166534; font-size:15px;">
        <strong>Great news!</strong> Your bulk pass request has been <strong>approved</strong> by the General Administrator.
      </p>

      <table style="width:100%; margin-top:24px; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0; color:#64748b;">Tracking Number</td>
          <td style="padding:6px 0; font-weight:600;">${trackingNumber}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Status</td>
          <td style="padding:6px 0; font-weight:600; color:#16a34a;">✓ APPROVED</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Approved Persons</td>
          <td style="padding:6px 0; font-weight:600;">${noOfPersons || 0}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Approved Vehicles</td>
          <td style="padding:6px 0; font-weight:600;">${noOfVehicles || 0}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Valid From</td>
          <td style="padding:6px 0; font-weight:600;">${validityFrom}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Valid Up To</td>
          <td style="padding:6px 0; font-weight:600;">${validityUpto}</td>
        </tr>
        ${remarks ? `
        <tr>
          <td style="padding:6px 0; color:#64748b; vertical-align:top;">Admin Remarks</td>
          <td style="padding:6px 0; font-weight:600;">${remarks}</td>
        </tr>
        ` : ''}
      </table>

      <div style="margin-top:32px; padding:20px; background:#eff6ff; border-radius:8px; border:2px solid #3b82f6;">
        <p style="margin:0 0 12px; font-size:15px; font-weight:600; color:#1e40af;">
          🔗 Your Secure Upload Link
        </p>
        <p style="margin:0 0 16px; font-size:13px; color:#475569;">
          Click the button below to upload visitor and vehicle details. This link supports <strong>multiple submissions</strong> within the validity period.
        </p>
        <p style="text-align:center; margin:0;">
          <a href="${uploadLink}"
             style="background:#2563eb; color:#fff; text-decoration:none;
                    padding:14px 32px; border-radius:6px; font-weight:600;
                    display:inline-block; font-size:15px;">
            Upload Visitor & Vehicle Details
          </a>
        </p>
      </div>

      <p style="font-size:13px; color:#475569; margin-top:16px;">
        If the button above doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="word-break:break-all; font-size:12px; background:#f8fafc; padding:10px; border-radius:4px; border:1px solid #e2e8f0;">
        <a href="${uploadLink}" style="color:#2563eb;">${uploadLink}</a>
      </p>

      <div style="margin-top:32px; padding:16px; background:#fef3c7; border-left:4px solid #f59e0b; border-radius:4px;">
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#92400e;">
          ⚠️ Multiple Submission Capability
        </p>
        <p style="margin:0; font-size:13px; color:#92400e;">
          Your upload link can be used <strong>multiple times</strong> until <strong>${validityUpto}</strong>. Each submission will be reviewed independently by the Traffic Department.
        </p>
      </div>

      <div style="margin-top:24px; padding:16px; background:#f0fdf4; border-left:4px solid #16a34a; border-radius:4px;">
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#166534;">
          📋 Submission Instructions:
        </p>
        <ol style="margin:8px 0 0; padding-left:20px; font-size:13px; color:#166534; line-height:1.6;">
          <li style="margin-bottom:8px;">
            <strong>Upload Excel File:</strong> Download the template from the upload page, fill in person and vehicle details (maximum 30 persons per submission), and upload the completed Excel file.
          </li>
          <li style="margin-bottom:8px;">
            <strong>Upload Documents:</strong> For each person, upload a passport-size photo (JPG/PNG, max 2MB) and Aadhaar document (PDF, max 5MB). For vehicles, upload RC and insurance documents (PDF, max 5MB each).
          </li>
          <li style="margin-bottom:8px;">
            <strong>Review & Submit:</strong> Verify all details are correct before submitting. Once submitted, your batch will be assigned a reference number and sent to the Traffic Department for approval.
          </li>
          <li style="margin-bottom:8px;">
            <strong>Multiple Submissions:</strong> After submitting, you can click "Submit Another Pass" to upload additional batches using the same link until the validity period expires.
          </li>
          <li style="margin-bottom:8px;">
            <strong>Track Status:</strong> You will receive email notifications for each submission with approval status updates from the Traffic Department.
          </li>
        </ol>
      </div>

      <div style="margin-top:24px; padding:16px; background:#fef2f2; border-left:4px solid #ef4444; border-radius:4px;">
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#991b1b;">
          🚨 Important Security Notes:
        </p>
        <ul style="margin:8px 0 0; padding-left:20px; font-size:13px; color:#991b1b; line-height:1.6;">
          <li style="margin-bottom:6px;">This link is <strong>unique and confidential</strong>. Do not share it with unauthorized persons.</li>
          <li style="margin-bottom:6px;">The link remains active until <strong>${validityUpto}</strong>. After this date, new submissions will not be accepted.</li>
          <li style="margin-bottom:6px;">Each person's Aadhaar number and each vehicle's registration number will be validated against blacklists.</li>
          <li style="margin-bottom:6px;">Maximum <strong>30 persons</strong> and <strong>20 vehicles</strong> per individual submission.</li>
        </ul>
      </div>

      <div style="margin-top:32px; padding:16px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0;">
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#334155;">
          📞 Need Help?
        </p>
        <p style="margin:0; font-size:13px; color:#475569;">
          For technical support or queries regarding your bulk pass application, contact:<br/>
          <strong>Chennai Port Authority Helpdesk</strong><br/>
          Email: <a href="mailto:helpdesk@chennaiport.gov.in" style="color:#2563eb;">helpdesk@chennaiport.gov.in</a><br/>
          Phone: +91-44-XXXX-XXXX (Working hours: 9:00 AM - 5:30 PM, Mon-Fri)
        </p>
      </div>

      <p style="margin-top:32px; font-size:12px; color:#94a3b8;">
        This email is auto-generated. Please do not reply. Save this email for future reference as it contains your secure upload link.
      </p>

      <p style="margin-top:24px;">Best Regards,<br/><strong>General Administrator</strong><br/>Chennai Port Authority</p>
    </div>
  </div>
  `;
};

module.exports = publicRequestApprovedTemplate;
