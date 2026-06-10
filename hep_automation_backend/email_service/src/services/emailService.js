const transporter = require("../config/emailConfig");
const template = require("../emailTemplates/referenceNumberTemplate");
const approvalTemplate = require("../emailTemplates/agentApprovedTemplate");
const rejectionTemplate = require("../emailTemplates/agentRejectedTemplate");
const deptUserCreationTemplate = require("../emailTemplates/deptUserAccountCreationTemplate");
const deptUserActivatedTemplate = require("../emailTemplates/deptUserAccountActivationTemplate");
const deptUserDisabledTemplate = require("../emailTemplates/deptUserAccountDeactivationTemplate");
const updatedAfterRevertTemplate = require("../emailTemplates/updatedAfterRevertEmail");
const revertedAgentRequestTemplate = require("../emailTemplates/revertedAgentRequestTemplate");
const vendorPassLinkTemplate = require("../emailTemplates/vendorPassLinkTemplate");
const revertedPassTemplate = require("../emailTemplates/revertedPassTemplate");
const vendorPassApprovedTemplate = require("../emailTemplates/vendorPassApprovedTemplate");
const forgotPasswordOTPTemplate = require("../emailTemplates/forgotPasswordOTPTemplate");

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

const sendUpdatedAfterRevertEmail = async (email, name, referenceNumber) => {

  const html = updatedAfterRevertTemplate(name, referenceNumber);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Agent Registration Updated",
    html
  };

  return transporter.sendMail(mailOptions);

};

const sendRevertedAgentRequestEmail = async (email,name,referenceNumber,reason) => {

  const html = revertedAgentRequestTemplate(
    name,
    referenceNumber,
    reason
  );

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Chennai Port Agent Registration Request Reverted",
    html
  };

  return transporter.sendMail(mailOptions);

};

const sendVendorPassLinkEmail = async ({
  email,
  companyName,
  referenceNo,
  link,
  validUpto,
  departmentName,
}) => {

  const html = vendorPassLinkTemplate({
    companyName,
    referenceNo,
    link,
    validUpto,
    departmentName,
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Chennai Port — Vendor Pass Application (${referenceNo})`,
    html
  };

  return transporter.sendMail(mailOptions);
};

const sendPassRevertedEmail = async (email, name, referenceNumber, revertedEntities, revertedCount) => {
  console.log(`[EMAIL-SVC] Preparing to send revert email to ${email}`);
  console.log(`[EMAIL-SVC] Reverted count: ${revertedCount || revertedEntities?.length || 0}`);
  
  const html = revertedPassTemplate(name, referenceNumber, revertedEntities, revertedCount);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `⚠️ Chennai Port Pass Application Reverted (${referenceNumber})`,
    html
  };

  console.log(`[EMAIL-SVC] Sending email via transporter to ${email}`);
  const result = await transporter.sendMail(mailOptions);
  console.log(`[EMAIL-SVC] Email sent successfully:`, result.messageId);
  return result;
};

const sendVendorPassApprovedEmail = async ({
  email,
  companyName,
  referenceNo,
  qrLink,
  approvedPersonsCount,
  approvedVehiclesCount,
  validUpto,
  departmentName,
  finalStatus = 'APPROVED'
}) => {
  const html = vendorPassApprovedTemplate({
    companyName,
    referenceNo,
    qrLink,
    approvedPersonsCount,
    approvedVehiclesCount,
    validUpto,
    departmentName,
    finalStatus
  });

  let subject = `✅ Your Chennai Port Vendor Pass is Approved (${referenceNo})`;
  if (finalStatus === 'COMPLETED') {
    subject = `✅ Your Chennai Port Vendor Pass Review is Completed (${referenceNo})`;
  } else if (finalStatus === 'REVERTED') {
    subject = `⚠️ Action Required: Vendor Pass Returned for Correction (${referenceNo})`;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject,
    html
  };

  console.log(`[EMAIL-SVC] Sending vendor pass approval email to ${email}`);
  const result = await transporter.sendMail(mailOptions);
  console.log(`[EMAIL-SVC] Vendor approval email sent:`, result.messageId);
  return result;
};

const sendForgotPasswordOTPEmail = async (email, name, otp) => {
  const html = forgotPasswordOTPTemplate(name, otp);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Chennai Port Authority - Password Reset OTP",
    html
  };

  return transporter.sendMail(mailOptions);
};

const sendForgotPasswordOtpEmail = async (email, name, otp) => {
  return sendForgotPasswordOTPEmail(email, name || "User", otp);
};

module.exports = { sendReferenceEmail, sendApprovalEmail, 
  sendRejectionEmail, sendDeptUserCreationEmail, sendDeptUserActivatedEmail, 
  sendDeptUserDisabledEmail, sendUpdatedAfterRevertEmail, sendRevertedAgentRequestEmail,
  sendVendorPassLinkEmail, sendPassRevertedEmail, sendVendorPassApprovedEmail,
  sendForgotPasswordOTPEmail, sendForgotPasswordOtpEmail };