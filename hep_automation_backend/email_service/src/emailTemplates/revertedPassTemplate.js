module.exports = (name, referenceNumber, revertedEntities, revertReasons) => {
  // Build list of reverted entity names
  const entityList = revertedEntities.map(e => 
    `<li><strong>${e.type === 'person' ? 'Person' : 'Vehicle'}:</strong> ${e.name} - ${e.reason}</li>`
  ).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { background: #1e3a8a; color: white; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
    .highlight { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
    .entity-list { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>⚠️ Pass Application Reverted</h2>
    </div>
    
    <div class="content">
      <p>Dear <strong>${name}</strong>,</p>
      
      <p>Your pass application with reference number <strong style="color: #f59e0b; font-size: 16px;">${referenceNumber}</strong> has been reviewed and requires corrections.</p>
      
      <div class="highlight">
        <strong>Action Required:</strong> Please login to your dashboard, navigate to <strong>"Reverted Applications"</strong> section, and update the information for the following entities:
      </div>
      
      <div class="entity-list">
        <h3 style="margin-top: 0; color: #374151;">Reverted Entities:</h3>
        <ul style="color: #4b5563;">
          ${entityList}
        </ul>
      </div>
      
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
        <a href="${process.env.FRONTEND_URL}/dashboard/pass_request" class="button">Go to Dashboard</a>
      </p>
      
      <p style="font-size: 13px; color: #6b7280; margin-top: 30px;">
        <strong>Note:</strong> Approved and rejected entities in your application cannot be modified. Only the reverted entities shown above need your attention.
      </p>
    </div>
    
    <div class="footer">
      <p><strong>Chennai Port Authority</strong><br/>
      HEP Automation System</p>
      <p style="margin-top: 10px; font-size: 11px;">This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`;
};
