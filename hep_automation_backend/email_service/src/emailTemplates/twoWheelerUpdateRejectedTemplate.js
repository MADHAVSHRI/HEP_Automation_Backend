/**
 * Two-Wheeler Vehicle Update Rejected Email Template
 * Sent to the agent/company when their two-wheeler vehicle update request is rejected.
 */
const twoWheelerUpdateRejectedTemplate = (name, referenceNumber, oldVehicleNo, newVehicleNo, rejectedReason) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin:0; padding:0; background:#f3f4f6;">
  <div style="max-width: 620px; margin: 0 auto; padding: 20px;">

    <!-- Header Banner -->
    <div style="background: linear-gradient(90deg, #b91c1c, #dc2626); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin:0; font-size:20px;">❌ Two-Wheeler Vehicle Update Rejected</h2>
      <p style="margin:6px 0 0; font-size:13px; opacity:0.9;">Chennai Port Authority — HEP Automation Portal</p>
    </div>

    <!-- Content Card -->
    <div style="background: #ffffff; padding: 28px; border: 1px solid #e5e7eb; border-top: none;">
      <p>Dear <strong>${name || "Company / Agent"}</strong>,</p>

      <p style="background:#fef2f2; padding:14px 16px; border-radius:6px; color:#b91c1c; border-left:4px solid #dc2626; margin: 16px 0;">
        <strong>Your request to update the two-wheeler vehicle number has been REJECTED.</strong><br/>
        Please review the reason below. The registered vehicle number remains unchanged.
      </p>

      <table style="width:100%; margin-top:20px; font-size:14px; border-collapse:collapse; background:#f9fafb; border-radius:6px; border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:12px 16px; color:#64748b; border-bottom:1px solid #e5e7eb; width:40%;">Pass / Ref Number</td>
          <td style="padding:12px 16px; font-weight:bold; border-bottom:1px solid #e5e7eb; color:#0a1e4d; font-family:monospace;">${referenceNumber}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px; color:#64748b; border-bottom:1px solid #e5e7eb;">Requested Vehicle No.</td>
          <td style="padding:12px 16px; font-weight:bold; border-bottom:1px solid #e5e7eb; color:#dc2626; font-family:monospace;">${newVehicleNo}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px; color:#64748b; border-bottom:1px solid #e5e7eb;">Current Active Vehicle No.</td>
          <td style="padding:12px 16px; font-weight:bold; border-bottom:1px solid #e5e7eb; color:#1e293b; font-family:monospace;">${oldVehicleNo || "N/A"}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px; color:#64748b;">Rejection Reason</td>
          <td style="padding:12px 16px; font-weight:bold; color:#dc2626;">${rejectedReason || "Request rejected by approver"}</td>
        </tr>
      </table>

      <p style="font-size:13px; color:#6b7280; margin-top:24px;">
        If you have questions regarding this rejection, please contact the Traffic Pass Section.
      </p>

      <p style="margin-top:24px;">Regards,<br/><strong>Chennai Port Authority</strong><br/>Traffic Department</p>
    </div>

    <!-- Footer -->
    <div style="background: #b91c1c; color: white; padding: 16px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
      <p style="margin:0;"><strong>Chennai Port Authority</strong><br/>HEP Automation Portal</p>
      <p style="margin-top:8px; font-size:11px; opacity:0.8;">This is an automated message. Please do not reply directly to this email.</p>
    </div>

  </div>
</body>
</html>
  `;
};

module.exports = twoWheelerUpdateRejectedTemplate;
