const transporter = require("../config/emailConfig");
const template = require("../emailTemplates/referenceNumberTemplate");
const approvalTemplate = require("../emailTemplates/agentApprovedTemplate");
const rejectionTemplate = require("../emailTemplates/agentRejectedTemplate");
const deptUserCreationTemplate = require("../emailTemplates/deptUserAccountCreationTemplate");
const deptUserActivatedTemplate = require("../emailTemplates/deptUserAccountActivationTemplate");
const deptUserDisabledTemplate = require("../emailTemplates/deptUserAccountDeactivationTemplate");
// const revertedAgentRequestTemplate = require("../emailTemplates/revertedAgentRequestTemplate");

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

const sendDeptUserCreationEmail = async (email, name, status) => {

  const html = deptUserCreationTemplate(name, status);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Chennai Port Department User Creation",
    html
  };

  return transporter.sendMail(mailOptions);
};

const sendDeptUserActivatedEmail = async (email, name, status) => {

  const html = deptUserActivatedTemplate(name, status);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Chennai Port Department User Account Activated",
    html
  };

  return transporter.sendMail(mailOptions);
};

const sendDeptUserDisabledEmail = async (email, name, status) => {

  const html = deptUserDisabledTemplate(name, status);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Chennai Port Department User Account Disabled",
    html
  };

  return transporter.sendMail(mailOptions);
};

// const sendRevertedAgentRequestEmail = async (email, name, referenceNumber) => {

//   const html = revertedAgentRequestTemplate(name, referenceNumber);

//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to: email,
//     subject: "Chennai Port Agent Registration Request Reverted",
//     html
//   };

//   return transporter.sendMail(mailOptions);
// };

module.exports = { sendReferenceEmail, sendApprovalEmail, 
  sendRejectionEmail, sendDeptUserCreationEmail, sendDeptUserActivatedEmail, 
  sendDeptUserDisabledEmail };