const userActivatedTemplate = (name, status)=>{

return `
<h2>Chennai Port Authority</h2>

<p>Dear ${name},</p>

<p>Your account has been activated. Status: ${status}</p>

<p>You can now login to the portal.</p>

<br/>

<p>Regards,<br/>
Chennai Port Authority</p>
`;

};

module.exports=userActivatedTemplate;