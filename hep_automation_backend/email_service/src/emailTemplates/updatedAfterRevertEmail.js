module.exports = (name, referenceNumber) => {

return `
<h3>Agent Registration Update</h3>

<p>Dear ${name},</p>

<p>Your agent registration request (Reference Number: <b>${referenceNumber}</b>)
has been updated successfully.</p>

<p>Your request has been submitted again and is currently waiting for
admin approval.</p>

<p>You will receive login credentials once approved.</p>

<p>Regards,<br>
Chennai Port Authority</p>
`;

};