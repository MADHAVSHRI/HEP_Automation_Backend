const deptUserAccountCreationTemplate = (name, status) => {
  return `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color:#374151; max-width:600px; margin:0 auto; background-color:#f9fafb; padding: 20px;">
    <div style="background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); color:#ffffff; padding:32px 24px; border-radius:12px 12px 0 0; text-align:center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
      <h1 style="margin:0; font-size:24px; font-weight:700; letter-spacing:-0.025em;">Chennai Port Authority</h1>
      <p style="margin:6px 0 0; font-size:14px; color:#fef3c7; font-weight:500;">
        Account Created
      </p>
    </div>

    <div style="background:#ffffff; border:1px solid #e5e7eb; border-top:none; padding:32px 24px; border-radius:0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <p style="font-size:16px; line-height:24px; margin:0 0 16px; color:#1f2937;">Dear <strong>${name}</strong>,</p>

      <p style="font-size:15px; line-height:24px; margin:0 0 20px; color:#4b5563;">
        Your account has been successfully created on the Automated Port Access Control System.
      </p>
      
      <div style="background-color:#fffbeb; border-left:4px solid #f59e0b; padding:16px; border-radius:6px; margin:24px 0;">
        <p style="margin:0; font-size:14px; font-weight:700; color:#b45309;">
          Pending Activation
        </p>
        <p style="margin:6px 0 0; font-size:13px; line-height:20px; color:#78350f;">
          Please wait until the administrator activates your account. You will receive another notification email once your account is activated and ready for use.
        </p>
      </div>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8; line-height:1.6; border-top:1px solid #f3f4f6; padding-top:16px;">
        This email is auto-generated. Please do not reply. For assistance, contact Chennai Port Authority Helpdesk.
      </p>

      <p style="margin-top:24px; font-size:14px; color:#4b5563; line-height:1.5;">
        Regards,<br/>
        <strong>Chennai Port Authority Admin Team</strong>
      </p>
    </div>
  </div>
  `;
};

module.exports = deptUserAccountCreationTemplate;