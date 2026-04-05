const transporter = require("../config/emailConfig");
const template = require("../emailTemplates/referenceNumberTemplate");
const approvalTemplate = require("../emailTemplates/agentApprovedTemplate");
const rejectionTemplate = require("../emailTemplates/agentRejectedTemplate");

const sendReferenceEmail = async (email, name, referenceNumber) => {

  const html = template(referenceNumber, name);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Chennai Port Agent Registration",
    html: html
  };

  return transporter.sendMail(mailOptions);
};

const sendApprovalEmail = async (email, name, loginId, password) => {

  const html = approvalTemplate(name, loginId, password);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Chennai Port Agent Approval",
    html
  };

  return transporter.sendMail(mailOptions);
};

const sendRejectionEmail = async (email, name, referenceNumber, reason) => {

  const html = rejectionTemplate(name, referenceNumber, reason);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Chennai Port Agent Registration Rejected",
    html
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendReferenceEmail, sendApprovalEmail, sendRejectionEmail };