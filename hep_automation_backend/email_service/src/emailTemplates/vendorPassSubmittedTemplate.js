/**
 * Vendor Pass Submission Acknowledgement Email Template
 * Sent to the vendor after they successfully submit their pass application form.
 */
const vendorPassSubmittedTemplate = ({
  companyName,
  referenceNo,
  personsCount = 0,
  vehiclesCount = 0,
  departmentName,
}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin:0; padding:0; background:#f3f4f6;">
  <div style="max-width: 620px; margin: 0 auto; padding: 20px;">

    <div style="background: linear-gradient(90deg, #0a1e4d, #1e3a8a); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin:0; font-size:20px;">✅ Application Received</h2>
      <p style="margin:6px 0 0; font-size:13px; opacity:0.9;">Chennai Port Authority — HEP Automation System</p>
    </div>

    <div style="background: #f9fafb; padding: 28px; border: 1px solid #e5e7eb; border-top: none;">
      <p>Dear <strong>${companyName || 'Vendor'}</strong>,</p>

      <p style="background:#dcfce7; padding:14px 16px; border-radius:6px; color:#166534; border-left:4px solid #16a34a;">
        <strong>✅ Your vendor pass application has been successfully submitted.</strong><br/>
        We have received your application and it is now under review}.
      </p>

      <table style="width:100%; margin-top:20px; font-size:14px; border-collapse:collapse; background:white; border-radius:6px; border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:12px 16px; color:#64748b; border-bottom:1px solid #e5e7eb; width:50%;">Reference Number</td>
          <td style="padding:12px 16px; font-weight:bold; border-bottom:1px solid #e5e7eb; color:#0a1e4d;">${referenceNo}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px; color:#64748b; border-bottom:1px solid #e5e7eb;">Persons Submitted</td>
          <td style="padding:12px 16px; font-weight:bold; border-bottom:1px solid #e5e7eb;">${personsCount} person pass${personsCount !== 1 ? 'es' : ''}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px; color:#64748b;">Vehicles Submitted</td>
          <td style="padding:12px 16px; font-weight:bold;">${vehiclesCount} vehicle pass${vehiclesCount !== 1 ? 'es' : ''}</td>
        </tr>
      </table>

      <div style="background:#eff6ff; padding:16px; border-radius:6px; margin:24px 0; border-left:4px solid #2563eb;">
        <strong style="color:#1e40af;">What happens next?</strong>
        <ol style="margin:10px 0 0; padding-left:20px; color:#1e40af; font-size:13px;">
          <li>Our department officials will review your submitted application</li>
          <li>Each person and vehicle pass will be individually verified</li>
          <li>You will receive an email once the review is completed</li>
          <li>If any correction is required, we will notify you with details</li>
        </ol>
      </div>

      <p style="font-size:13px; color:#6b7280; margin-top:24px;">
        Please keep your reference number <strong>${referenceNo}</strong> handy for any future correspondence regarding this application.
      </p>

      <p style="margin-top:24px;">Regards,<br/><strong>Chennai Port Authority</strong><br/>${departmentName || 'Traffic Department'}</p>
    </div>

    <div style="background: #1e3a8a; color: white; padding: 16px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
      <p style="margin:0;"><strong>Chennai Port Authority</strong><br/>HEP Automation System</p>
      <p style="margin-top:8px; font-size:11px; opacity:0.8;">This is an automated message. Please do not reply to this email.</p>
    </div>

  </div>
</body>
</html>
`;
};

module.exports = vendorPassSubmittedTemplate;
