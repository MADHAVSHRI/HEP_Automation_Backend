const forgotPasswordOtpTemplate =
(name, otp) => {

return `
    <h2>Chennai Port Authority</h2>

    <p>Dear ${name},</p>

    <p>Your password reset OTP is:</p>

    <h1>${otp}</h1>

    <p>This OTP will expire in 5 minutes.</p>

    <p>If you did not request this reset,
    please ignore this email.</p>

    <br/>

    <p>
    Regards,<br/>
    Chennai Port Authority
    </p>
`;

};

module.exports = forgotPasswordOtpTemplate;
