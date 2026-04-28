module.exports = (name, referenceNumber, reason) => {

return `
<h3>Agent Registration Reverted</h3>

<p>Dear ${name},</p>

<p>Your agent registration request with reference number 
<b>${referenceNumber}</b> has been reverted by the Traffic Admin.</p>

<p><b>Reason:</b> ${reason}</p>

<p>Please update the required information or documents and submit 
your request again to proceed further.</p>

<p>Regards,<br/>
Chennai Port Authority</p>
`;

};