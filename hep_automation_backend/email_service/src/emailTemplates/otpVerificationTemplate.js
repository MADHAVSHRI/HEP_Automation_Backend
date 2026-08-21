const otpVerificationTemplate = ({ email, otp }) => {
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#f97316,#f59e0b); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Email Verification</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Harbor Entry Pass (HEP) System
      </p>
    </div>

    <div style="border:1px solid #fde7d2; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear Applicant,</p>

      <p>
        Thank you for submitting a bulk pass request through the Chennai Port public portal.
        To verify your email address, please use the One-Time Password (OTP) below:
      </p>

      <div style="background:#fef3c7; border:2px solid #fbbf24; border-radius:8px; padding:24px; margin:24px 0; text-align:center;">
        <p style="margin:0 0 8px; font-size:14px; color:#92400e; font-weight:500; text-transform:uppercase; letter-spacing:1px;">
          Your OTP Code
        </p>
        <p style="font-size:36px; font-weight:bold; letter-spacing:8px; color:#d97706; margin:0; font-family:'Courier New', monospace;">
          ${otp}
        </p>
      </div>

      <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:12px 16px; margin:20px 0; border-radius:4px;">
        <p style="margin:0; font-size:14px; color:#991b1b;">
          <strong>⏰ Important:</strong> This OTP is valid for <strong>10 minutes only</strong>. 
          Do not share this code with anyone.
        </p>
      </div>

      <p style="font-size:14px; margin-top:20px;">
        If you did not request this OTP, please ignore this email. Your account security is not compromised.
      </p>

      <div style="border-top:1px solid #e5e7eb; margin-top:32px; padding-top:20px;">
        <p style="font-size:13px; color:#64748b; margin:0 0 8px;">
          <strong>Need Help?</strong>
        </p>
        <p style="font-size:13px; color:#64748b; margin:0;">
          Email: <a href="mailto:support@chennaiport.gov.in" style="color:#f97316; text-decoration:none;">support@chennaiport.gov.in</a><br/>
          Phone: +91-44-2536-1234<br/>
          Working Hours: Monday - Friday, 9:00 AM - 5:30 PM IST
        </p>
      </div>

      <p style="margin-top:24px;">
        Regards,<br/>
        <strong>Chennai Port Authority</strong><br/>
        <span style="font-size:13px; color:#64748b;">Harbor Entry Pass (HEP) System</span>
      </p>
    </div>

    <div style="text-align:center; padding:16px; font-size:12px; color:#94a3b8;">
      <p style="margin:0;">
        This is an automated message from Chennai Port Authority.
      </p>
      <p style="margin:4px 0 0;">
        © ${new Date().getFullYear()} Chennai Port Authority. All rights reserved.
      </p>
    </div>
  </div>
  `;
};

module.exports = otpVerificationTemplate;
