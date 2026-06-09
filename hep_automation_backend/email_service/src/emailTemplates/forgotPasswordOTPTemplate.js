const forgotPasswordOTPTemplate = (name, otp) => {
  return `
  <h2>Chennai Port Authority</h2>
  <p>Dear ${name},</p>
  <p>You have requested to reset your password. Please use the following One-Time Password (OTP) to complete the reset process:</p>
  <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #d97706; margin: 15px 0;">${otp}</p>
  <p>This OTP is valid for 5 minutes.</p>
  <br/>
  <p>Regards,<br/>
  Chennai Port Authority</p>
  `;
};

module.exports = forgotPasswordOTPTemplate;
