const agentRejectionTemplate = (name, referenceNumber, reason) => {

  return `
  <h2>Chennai Port Authority</h2>

  <p>Dear ${name},</p>

  <p>Your registration request has been <b>rejected</b>.</p>

  <p><b>Reference Number:</b> ${referenceNumber}</p>

  <p><b>Reason for Rejection:</b></p>

  <p>${reason}</p>

  <p>You may re-apply after correcting the issue.</p>

  <br/>

  <p>Regards,<br/>
  Chennai Port Authority</p>
  `;

};

module.exports = agentRejectionTemplate;