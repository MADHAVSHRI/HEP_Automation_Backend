module.exports = (name, referenceNumber, revertedEntities, revertReasons, formLink = null) => {
  const isVendor = !!formLink;

  // Separate by type for grouped tables
  const persons = (revertedEntities || []).filter(e => e.type === 'person');
  const vehicles = (revertedEntities || []).filter(e => e.type === 'vehicle');

  const tableStyle = `width:100%; border-collapse:collapse; font-size:13px; margin-bottom:20px;`;
  const thStyle = `background:#f59e0b; color:#fff; padding:8px 12px; text-align:left; font-weight:bold;`;
  const tdStyle = `padding:8px 12px; border-bottom:1px solid #e5e7eb; vertical-align:top;`;
  const tdAltStyle = `padding:8px 12px; border-bottom:1px solid #e5e7eb; vertical-align:top; background:#fffbeb;`;

  const buildTable = (rows, columns) => {
    if (!rows || rows.length === 0) return '';
    const header = `<tr>${columns.map(c => `<th style="${thStyle}">${c}</th>`).join('')}</tr>`;
    const body = rows.map((row, i) =>
      `<tr>${row.map(cell => `<td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${cell}</td>`).join('')}</tr>`
    ).join('');
    return `<table style="${tableStyle}"><thead>${header}</thead><tbody>${body}</tbody></table>`;
  };

  const personsSection = persons.length > 0
    ? `<h4 style="margin:16px 0 6px; color:#374151; font-size:13px;">
        👤 Person Passes Requiring Correction (${persons.length})
       </h4>
       ${buildTable(
         persons.map((p, i) => [`${i + 1}`, p.name || '—', p.reason || 'Correction required']),
         ['#', 'Person Name', 'Reason for Return']
       )}`
    : '';

  const vehiclesSection = vehicles.length > 0
    ? `<h4 style="margin:16px 0 6px; color:#374151; font-size:13px;">
        🚗 Vehicle Passes Requiring Correction (${vehicles.length})
       </h4>
       ${buildTable(
         vehicles.map((v, i) => [`${i + 1}`, v.name || '—', v.reason || 'Correction required']),
         ['#', 'Registration No.', 'Reason for Return']
       )}`
    : '';

  const totalCount = (revertedEntities || []).length;

  const actionSection = isVendor
    ? `
      <div style="background: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <strong style="color: #1e40af;">How to proceed:</strong>
        <ol style="margin: 10px 0; padding-left: 20px; color: #1e40af;">
          <li>Click the button below to open your Vendor Pass form directly</li>
          <li>Find the reverted entries listed above and update the required information</li>
          <li>Upload any missing or corrected documents</li>
          <li>Click <strong>"Resubmit Application"</strong></li>
        </ol>
      </div>
      
      <p style="text-align: center;">
        <a href="${formLink}" style="display:inline-block; background:#f59e0b; color:white; padding:12px 30px; text-decoration:none; border-radius:6px; font-weight:bold; margin:20px 0;">Update Vendor Pass Application</a>
      </p>
      
      <p style="font-size: 12px; color: #6b7280; text-align: center;">
        Or copy this link: <span style="word-break:break-all; color: #1e40af;">${formLink}</span>
      </p>
    `
    : `
      <div style="background: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <strong style="color: #1e40af;">How to proceed:</strong>
        <ol style="margin: 10px 0; padding-left: 20px; color: #1e40af;">
          <li>Login to your HEP Automation Portal</li>
          <li>Go to <strong>Dashboard → Pass Request → Reverted Applications</strong></li>
          <li>Click on your application <strong>${referenceNumber}</strong></li>
          <li>Update the required information for reverted entities</li>
          <li>Click <strong>"Resubmit Application"</strong></li>
        </ol>
      </div>
      
      <p style="text-align: center;">
        <a href="${process.env.FRONTEND_URL}/dashboard/pass_request" style="display:inline-block; background:#f59e0b; color:white; padding:12px 30px; text-decoration:none; border-radius:6px; font-weight:bold; margin:20px 0;">Go to Dashboard</a>
      </p>
    `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin:0; padding:0; background:#f3f4f6;">
  <div style="max-width: 620px; margin: 0 auto; padding: 20px;">
    
    <div style="background: #f59e0b; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin:0; font-size:20px;">⚠️ Pass Application Returned for Correction</h2>
      <p style="margin:6px 0 0; font-size:13px; opacity:0.9;">Chennai Port Authority — HEP Automation System</p>
    </div>
    
    <div style="background: #f9fafb; padding: 28px; border: 1px solid #e5e7eb; border-top: none;">
      <p>Dear <strong>${name}</strong>,</p>
      
      <p>Your pass application with reference number <strong style="color: #f59e0b; font-size: 16px;">${referenceNumber}</strong> has been reviewed. A total of <strong>${totalCount}</strong> ${totalCount === 1 ? 'entry requires' : 'entries require'} correction before final approval.</p>
      
      <div style="background: #fef3c7; padding: 14px 16px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 0 6px 6px 0;">
        <strong>⚡ Action Required:</strong> Please review and resubmit the following ${totalCount === 1 ? 'entry' : 'entries'} with corrected information:
      </div>
      
      <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 16px 0;">
        ${personsSection}
        ${vehiclesSection}
      </div>
      
      ${actionSection}
      
      <p style="font-size: 13px; color: #6b7280; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <strong>Note:</strong> Approved and rejected entries in your application cannot be modified. Only the entries listed above need your attention.
      </p>
    </div>
    
    <div style="background: #1e3a8a; color: white; padding: 16px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
      <p style="margin:0;"><strong>Chennai Port Authority</strong><br/>HEP Automation System</p>
      <p style="margin-top: 8px; font-size: 11px; opacity: 0.8;">This is an automated message. Please do not reply to this email.</p>
    </div>
    
  </div>
</body>
</html>
`;
};
