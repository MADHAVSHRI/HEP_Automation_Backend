const agentApprovalTemplate = (name, loginId, password) => {

  return `
  <h2>Chennai Port Authority</h2>

  <p>Dear ${name},</p>

  <p>Your registration request has been <b>approved</b>.</p>

  <p>You can login using the following credentials:</p>

  <p><b>Login ID:</b> ${loginId}</p>
  <p><b>Password:</b> ${password}</p>

  <p>Please change your password after first login.</p>

  <br/>

  <p>Regards,<br/>
  Chennai Port Authority</p>
  `;

};

module.exports = agentApprovalTemplate;