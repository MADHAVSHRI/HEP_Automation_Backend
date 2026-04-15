const userActivatedTemplate = (name)=>{

return `
<h2>Chennai Port Authority</h2>

<p>Dear ${name},</p>

<p>Your account has been activated.</p>

<p>You can now login to the portal.</p>

<br/>

<p>Regards,<br/>
Chennai Port Authority</p>
`;

};

module.exports=userActivatedTemplate;