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
const bulkPassInvitationTemplate = require("../emailTemplates/bulkPassInvitationTemplate");
const bulkPassSubmittedTemplate = require("../emailTemplates/bulkPassSubmittedTemplate");
const bulkPassUnderReviewTemplate = require("../emailTemplates/bulkPassUnderReviewTemplate");
const bulkPassReturnedTemplate = require("../emailTemplates/bulkPassReturnedTemplate");
const bulkPassApprovedTemplate = require("../emailTemplates/bulkPassApprovedTemplate");
const bulkPassRejectedTemplate = require("../emailTemplates/bulkPassRejectedTemplate");
const bulkPassRejectedPersonsTemplate = require("../emailTemplates/bulkPassRejectedPersonsTemplate");
const vendorPassSubmittedTemplate = require("../emailTemplates/vendorPassSubmittedTemplate");
const profileUpdateSubmittedTemplate = require("../emailTemplates/profileUpdateSubmittedTemplate");
const profileUpdateApprovedTemplate = require("../emailTemplates/profileUpdateApprovedTemplate");
const profileUpdateRevertedTemplate = require("../emailTemplates/profileUpdateRevertedTemplate");
const profileUpdateRejectedTemplate = require("../emailTemplates/profileUpdateRejectedTemplate");
const twoWheelerUpdateSubmittedTemplate = require("../emailTemplates/twoWheelerUpdateSubmittedTemplate");
const twoWheelerUpdateApprovedTemplate = require("../emailTemplates/twoWheelerUpdateApprovedTemplate");
const twoWheelerUpdateRejectedTemplate = require("../emailTemplates/twoWheelerUpdateRejectedTemplate");
const licenseExpiryWarningTemplate = require("../emailTemplates/licenseExpiryWarningTemplate");
const overstayReminderTemplate = require("../emailTemplates/overstayReminderTemplate");
const overstayLeviedTemplate = require("../emailTemplates/overstayLeviedTemplate");
const otpVerificationTemplate = require("../emailTemplates/otpVerificationTemplate");
const publicRequestAcknowledgmentTemplate = require("../emailTemplates/publicRequestAcknowledgmentTemplate");
const adminNewPublicRequestTemplate = require("../emailTemplates/adminNewPublicRequestTemplate");
const publicRequestApprovedTemplate = require("../emailTemplates/publicRequestApprovedTemplate");
const publicRequestRejectedTemplate = require("../emailTemplates/publicRequestRejectedTemplate");
const childBatchConfirmationTemplate = require("../emailTemplates/childBatchConfirmationTemplate");

const sendOverstayReminderEmail = async (data) => {
  const html = overstayReminderTemplate(data);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: data.email,
    subject: "Notice: Port Pass Expired — Immediate Action Required | Chennai Port APACS",
    html
  };
  return transporter.sendMail(mailOptions);
};

const sendOverstayLeviedEmail = async (data) => {
  const html = overstayLeviedTemplate(data);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: data.email,
    subject: "Notice: Overstay Fine Levied — Chennai Port APACS",
    html
  };
  return transporter.sendMail(mailOptions);
};

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

const sendPassRevertedEmail = async (email, name, referenceNumber, revertedEntities, revertedCount, formLink = null) => {
  console.log(`[EMAIL-SVC] Preparing to send revert email to ${email}`);
  console.log(`[EMAIL-SVC] Reverted count: ${revertedCount || revertedEntities?.length || 0}`);
  
  const html = revertedPassTemplate(name, referenceNumber, revertedEntities, revertedCount, formLink);

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

const sendVendorPassSubmittedEmail = async (payload) => {
  const html = vendorPassSubmittedTemplate(payload);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `✅ Application Received — Vendor Pass (${payload.referenceNo})`,
    html,
  };
  console.log(`[EMAIL-SVC] Sending vendor pass submission acknowledgement to ${payload.email}`);
  const result = await transporter.sendMail(mailOptions);
  console.log(`[EMAIL-SVC] Submission acknowledgement email sent:`, result.messageId);
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

// ── Bulk Pass Email Functions ────────────────────────────────────────────────

const sendBulkPassInvitationEmail = async (payload) => {
  const html = bulkPassInvitationTemplate(payload);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `Chennai Port — Bulk Pass Invitation (${payload.refNo})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendBulkPassSubmittedEmail = async (payload) => {
  const html = bulkPassSubmittedTemplate(payload);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `Chennai Port — Bulk Pass Submitted (${payload.refNo})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendBulkPassUnderReviewEmail = async (payload) => {
  const html = bulkPassUnderReviewTemplate(payload);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `Chennai Port — Bulk Pass Under Review (${payload.refNo})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendBulkPassReturnedEmail = async (payload) => {
  const html = bulkPassReturnedTemplate(payload);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `⚠️ Action Required — Bulk Pass Returned (${payload.refNo})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendBulkPassApprovedEmail = async (payload) => {
  const html = bulkPassApprovedTemplate(payload);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `✅ Bulk Pass Approved — Chennai Port (${payload.refNo})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendBulkPassRejectedEmail = async (payload) => {
  const html = bulkPassRejectedTemplate(payload);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `❌ Bulk Pass Rejected — Chennai Port (${payload.refNo})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendBulkPassRejectedPersonsEmail = async (payload) => {
  const html = bulkPassRejectedPersonsTemplate(payload);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `⚠️ Some Persons Not Approved — Bulk Pass (${payload.refNo})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendProfileUpdateSubmittedEmail = async (payload) => {
  const html = profileUpdateSubmittedTemplate(payload.name, payload.referenceNumber);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `Chennai Port — Profile Update Received (${payload.referenceNumber})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendProfileUpdateApprovedEmail = async (payload) => {
  const html = profileUpdateApprovedTemplate(payload.name, payload.referenceNumber);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `✅ Profile Update Approved — Chennai Port (${payload.referenceNumber})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendProfileUpdateRevertedEmail = async (payload) => {
  const html = profileUpdateRevertedTemplate(payload.name, payload.referenceNumber, payload.rejectedReason);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `⚠️ Profile Update Reverted — Chennai Port (${payload.referenceNumber})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendProfileUpdateRejectedEmail = async (payload) => {
  const html = profileUpdateRejectedTemplate(payload.name, payload.referenceNumber, payload.rejectedReason);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `❌ Profile Update Rejected — Chennai Port (${payload.referenceNumber})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendLicenseExpiryWarningEmail = async (payload) => {
  const html = licenseExpiryWarningTemplate(
    payload.name,
    payload.licenseNumber,
    payload.licenseValidityDate,
    payload.daysRemaining
  );
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `⚠️ URGENT: Chennai Port License Expiring in ${payload.daysRemaining} Days`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendTwoWheelerUpdateSubmittedEmail = async (payload) => {
  const html = twoWheelerUpdateSubmittedTemplate(
    payload.name,
    payload.referenceNumber,
    payload.oldVehicleNo,
    payload.newVehicleNo
  );
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `🛵 Two-Wheeler Vehicle Update Request Received (${payload.referenceNumber})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendTwoWheelerUpdateApprovedEmail = async (payload) => {
  const html = twoWheelerUpdateApprovedTemplate(
    payload.name,
    payload.referenceNumber,
    payload.oldVehicleNo,
    payload.newVehicleNo
  );
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `✅ Two-Wheeler Vehicle Update Approved — Chennai Port (${payload.referenceNumber})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

const sendTwoWheelerUpdateRejectedEmail = async (payload) => {
  const html = twoWheelerUpdateRejectedTemplate(
    payload.name,
    payload.referenceNumber,
    payload.oldVehicleNo,
    payload.newVehicleNo,
    payload.rejectedReason
  );
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: payload.email,
    subject: `❌ Two-Wheeler Vehicle Update Rejected — Chennai Port (${payload.referenceNumber})`,
    html,
  };
  return transporter.sendMail(mailOptions);
};

// ── Multiple Pass Submissions Email Functions ────────────────────────────────

const sendOTPEmail = async (email, otp) => {
  try {
    console.log(`[EMAIL-SVC] Preparing to send OTP email to ${email}`);
    
    const html = otpVerificationTemplate({ email, otp });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Chennai Port — Email Verification OTP",
      html,
    };

    console.log(`[EMAIL-SVC] Sending OTP email via transporter to ${email}`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL-SVC] OTP email sent successfully:`, result.messageId);
    return result;
  } catch (error) {
    console.error(`[EMAIL-SVC] Error sending OTP email to ${email}:`, error.message);
    if (process.env.NODE_ENV === "development" || !process.env.EMAIL_USER) {
      console.log(`\n==========================================\n[DEV MODE] OTP generated for ${email}: ${otp}\n==========================================\n`);
      return { messageId: "dev-mode-mock-id" };
    }
    throw error;
  }
};

const sendPublicRequestAcknowledgment = async (payload) => {
  try {
    console.log(`[EMAIL-SVC] Preparing to send public request acknowledgment to ${payload.applicantEmail}`);
    
    const html = publicRequestAcknowledgmentTemplate({
      companyName: payload.companyName,
      trackingNumber: payload.trackingNumber,
      submissionTimestamp: payload.submissionTimestamp,
      applicantEmail: payload.applicantEmail,
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: payload.applicantEmail,
      subject: `Chennai Port — Bulk Pass Request Received (${payload.trackingNumber})`,
      html,
    };

    console.log(`[EMAIL-SVC] Sending public request acknowledgment via transporter`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL-SVC] Acknowledgment email sent successfully:`, result.messageId);
    return result;
  } catch (error) {
    console.error(`[EMAIL-SVC] Error sending acknowledgment email:`, error);
    throw error;
  }
};

const sendAdminNotification = async (payload) => {
  try {
    console.log(`[EMAIL-SVC] Preparing to send admin notification for tracking: ${payload.trackingNumber}`);
    
    const html = adminNewPublicRequestTemplate({
      companyName: payload.companyName,
      applicantEmail: payload.applicantEmail,
      applicantMobile: payload.applicantMobile,
      noOfPersons: payload.noOfPersons,
      noOfVehicles: payload.noOfVehicles,
      validityFrom: payload.validityFrom,
      validityUpto: payload.validityUpto,
      visitorType: payload.visitorType,
      purpose: payload.purpose,
      trackingNumber: payload.trackingNumber,
      requestDetailLink: payload.requestDetailLink,
      submissionTimestamp: payload.submissionTimestamp,
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: payload.adminEmail || process.env.ADMIN_EMAIL,
      subject: `🔔 New Public Bulk Pass Request — ${payload.companyName} (${payload.trackingNumber})`,
      html,
    };

    console.log(`[EMAIL-SVC] Sending admin notification via transporter`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL-SVC] Admin notification email sent successfully:`, result.messageId);
    return result;
  } catch (error) {
    console.error(`[EMAIL-SVC] Error sending admin notification:`, error);
    throw error;
  }
};

const sendApprovalNotification = async (payload) => {
  try {
    console.log(`[EMAIL-SVC] Preparing to send approval notification to ${payload.applicantEmail}`);
    
    const html = publicRequestApprovedTemplate({
      companyName: payload.companyName,
      trackingNumber: payload.trackingNumber,
      uploadLink: payload.uploadLink,
      validityFrom: payload.validityFrom,
      validityUpto: payload.validityUpto,
      noOfPersons: payload.noOfPersons,
      noOfVehicles: payload.noOfVehicles,
      remarks: payload.remarks,
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: payload.applicantEmail,
      subject: `✅ Bulk Pass Request Approved — Chennai Port (${payload.trackingNumber})`,
      html,
    };

    console.log(`[EMAIL-SVC] Sending approval notification via transporter`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL-SVC] Approval notification email sent successfully:`, result.messageId);
    return result;
  } catch (error) {
    console.error(`[EMAIL-SVC] Error sending approval notification:`, error);
    throw error;
  }
};

const sendRejectionNotification = async (payload) => {
  try {
    console.log(`[EMAIL-SVC] Preparing to send rejection notification to ${payload.applicantEmail}`);
    
    const html = publicRequestRejectedTemplate({
      companyName: payload.companyName,
      trackingNumber: payload.trackingNumber,
      rejectionReason: payload.rejectionReason,
      submissionDate: payload.submissionDate,
      applicantEmail: payload.applicantEmail,
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: payload.applicantEmail,
      subject: `❌ Bulk Pass Request Rejected — Chennai Port (${payload.trackingNumber})`,
      html,
    };

    console.log(`[EMAIL-SVC] Sending rejection notification via transporter`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL-SVC] Rejection notification email sent successfully:`, result.messageId);
    return result;
  } catch (error) {
    console.error(`[EMAIL-SVC] Error sending rejection notification:`, error);
    throw error;
  }
};

const sendChildBatchConfirmation = async (payload) => {
  try {
    console.log(`[EMAIL-SVC] Preparing to send child batch confirmation to ${payload.applicantEmail}`);
    
    const html = childBatchConfirmationTemplate({
      companyName: payload.companyName,
      refNo: payload.refNo,
      submissionNumber: payload.submissionNumber,
      personsCount: payload.personsCount,
      vehiclesCount: payload.vehiclesCount,
      parentRefNo: payload.parentRefNo,
      parentCompanyName: payload.parentCompanyName,
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: payload.applicantEmail,
      subject: `✅ Submission #${payload.submissionNumber} Received — Chennai Port (${payload.refNo})`,
      html,
    };

    console.log(`[EMAIL-SVC] Sending child batch confirmation via transporter`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL-SVC] Child batch confirmation email sent successfully:`, result.messageId);
    return result;
  } catch (error) {
    console.error(`[EMAIL-SVC] Error sending child batch confirmation:`, error);
    throw error;
  }
};

module.exports = {
  sendReferenceEmail, sendApprovalEmail, 
  sendRejectionEmail, sendDeptUserCreationEmail, sendDeptUserActivatedEmail, 
  sendDeptUserDisabledEmail, sendUpdatedAfterRevertEmail, sendRevertedAgentRequestEmail,
  sendVendorPassLinkEmail, sendPassRevertedEmail, sendVendorPassApprovedEmail,
  sendVendorPassSubmittedEmail, sendOverstayReminderEmail, sendOverstayLeviedEmail,
  sendForgotPasswordOTPEmail, sendForgotPasswordOtpEmail,
  sendBulkPassInvitationEmail, sendBulkPassSubmittedEmail, sendBulkPassUnderReviewEmail,
  sendBulkPassReturnedEmail, sendBulkPassApprovedEmail, sendBulkPassRejectedEmail,
  sendBulkPassRejectedPersonsEmail,
  sendProfileUpdateSubmittedEmail, sendProfileUpdateApprovedEmail,
  sendProfileUpdateRevertedEmail, sendProfileUpdateRejectedEmail,
  sendTwoWheelerUpdateSubmittedEmail, sendTwoWheelerUpdateApprovedEmail,
  sendTwoWheelerUpdateRejectedEmail,
  sendLicenseExpiryWarningEmail,
  // Multiple Pass Submissions Functions
  sendOTPEmail,
  sendPublicRequestAcknowledgment,
  sendAdminNotification,
  sendApprovalNotification,
  sendRejectionNotification,
  sendChildBatchConfirmation
};