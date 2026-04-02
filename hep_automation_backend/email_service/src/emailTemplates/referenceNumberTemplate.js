const agentReferneceNumberTemplate = (referenceNumber, name) => {

return `
    <h2>Chennai Port Registration</h2>

    <p>Dear ${name},</p>

    <p>Your registration request has been received successfully.</p>

    <p>Your Reference Number:</p>

    <h3>${referenceNumber}</h3>

    <p>Please use this reference number for future communication.</p>

    <p>Regards,<br>
    Chennai Port Authority</p>
    `;

};

module.exports = agentReferneceNumberTemplate;