const deptUserAccountCreationTemplate = (name,status)=>{

return `
<h2>Chennai Port Authority</h2>

<p>Dear ${name},</p>

<p>Your account has been created successfully.</p>

<p>Status:<b>${status}</b></p>

<p>Please wait until admin activates your account.</p>

<br/>

<p>Regards,<br/>
Chennai Port Authority</p>
`;

};

module.exports = deptUserAccountCreationTemplate;