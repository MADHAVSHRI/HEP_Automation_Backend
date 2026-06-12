const deptUserAccountActivationTemplate = (name, status) => {
  return `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color:#374151; max-width:600px; margin:0 auto; background-color:#f9fafb; padding: 20px;">
    <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color:#ffffff; padding:32px 24px; border-radius:12px 12px 0 0; text-align:center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
      <h1 style="margin:0; font-size:24px; font-weight:700; letter-spacing:-0.025em;">Chennai Port Authority</h1>
      <p style="margin:6px 0 0; font-size:14px; color:#d1fae5; font-weight:500;">
        Account Activated
      </p>
    </div>

    <div style="background:#ffffff; border:1px solid #e5e7eb; border-top:none; padding:32px 24px; border-radius:0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <p style="font-size:16px; line-height:24px; margin:0 0 16px; color:#1f2937;">Dear <strong>${name}</strong>,</p>

      <p style="font-size:15px; line-height:24px; margin:0 0 20px; color:#4b5563;">
        Great news! Your account has been activated by the administrator. You now have full access to perform your designated role.
      </p>

      <p style="margin:32px 0; text-align:center;">
        <a href="http://localhost:3000"
           style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color:#ffffff; text-decoration:none;
                  padding:14px 32px; border-radius:8px; font-weight:700;
                  display:inline-block; font-size:15px; box-shadow:0 4px 10px rgba(16,185,129,0.3);">
          Login to Portal
        </a>
      </p>
      
      <div style="background-color:#ecfdf5; border-left:4px solid #10b981; padding:16px; border-radius:6px; margin:24px 0;">
        <p style="margin:0; font-size:14px; font-weight:700; color:#047857;">
          Next Steps
        </p>
        <p style="margin:6px 0 0; font-size:13px; line-height:20px; color:#065f46;">
          Click the button above to login using your registered credentials. If you are logging in for the first time, you may be prompted to change your password.
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

module.exports = deptUserAccountActivationTemplate;