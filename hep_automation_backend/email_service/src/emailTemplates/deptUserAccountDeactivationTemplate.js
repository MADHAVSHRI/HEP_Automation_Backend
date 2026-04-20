const userDeactivatedTemplate = (name,status)=>{

return `
<h2>Chennai Port Authority</h2>

<p>Dear ${name},</p>

<p>Your account has been Deactivated. Status: ${status}</p>

<p>Please contact chennai port admin helpdesk.</p>

<br/>

<p>Regards,<br/>
Chennai Port Authority</p>
`;

};

module.exports=userDeactivatedTemplate;