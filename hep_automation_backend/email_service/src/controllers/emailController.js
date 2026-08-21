const { sendReferenceEmail, sendApprovalEmail, sendRejectionEmail, 
  sendDeptUserCreationEmail, sendDeptUserActivatedEmail, sendDeptUserDisabledEmail,
  sendRevertedAgentRequestEmail,sendUpdatedAfterRevertEmail,
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
  sendChildBatchConfirmation } = require("../services/emailService");

exports.sendOverstayReminder = async (req, res) => {
  try {
    await sendOverstayReminderEmail(req.body);
    return res.json({ success: true, message: "Overstay reminder email sent" });
  } catch (error) {
    console.error("sendOverstayReminder error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};
exports.sendOverstayLevied = async (req, res) => {
  try {
    await sendOverstayLeviedEmail(req.body);
    return res.json({ success: true, message: "Overstay levied email sent" });
  } catch (error) {
    console.error("sendOverstayLevied error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};
exports.sendReference = async (req, res) => {

  try {

    const { email, name, referenceNumber } = req.body;

    await sendReferenceEmail(email, name, referenceNumber);

    return res.json({
      success: true,
      message: "Email sent successfully"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });
  }
};

exports.sendApproval = async (req, res) => {

  try {

    const { email, name, loginId, password } = req.body;

    await sendApprovalEmail(email, name, loginId, password);

    return res.json({
      success: true,
      message: "Approval email sent successfully"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });

  }

};

exports.sendRejection = async (req, res) => {

  try {

    const { email, name, referenceNumber, reason } = req.body;

    await sendRejectionEmail(email, name, referenceNumber, reason);

    return res.json({
      success: true,
      message: "Rejection email sent successfully"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });

  }

};

exports.sendDeptUserCreation = async (req, res) => {

  try {

    const { email, name, status } = req.body;

    await sendDeptUserCreationEmail(email, name, status);

    return res.json({
      success: true,
      message: "Department user creation email sent successfully"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });

  }

};

exports.sendDeptUserActivated = async (req, res) => {

  try {

    const { email, name, status } = req.body;

    await sendDeptUserActivatedEmail(email, name, status);

    return res.json({
      success: true,
      message: "Department user activated email sent successfully"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });

  }

};

exports.sendDeptUserDisabled = async (req, res) => {

  try {

    const { email, name, status } = req.body;

    await sendDeptUserDisabledEmail(email, name, status);

    return res.json({
      success: true,
      message: "Department user disabled email sent successfully"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });

  }

};

exports.sendRevertedAgentRequest = async (req, res) => {

  try {

    const { email, name, referenceNumber, reason } = req.body;

    await sendRevertedAgentRequestEmail(
      email,
      name,
      referenceNumber,
      reason
    );

    return res.json({
      success: true,
      message: "Reverted agent request email sent successfully"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });

  }

};

exports.sendUpdatedAfterRevert = async (req, res) => {

  try {

    const { email, name, referenceNumber } = req.body;

    await sendUpdatedAfterRevertEmail(email, name, referenceNumber);

    return res.json({
      success: true,
      message: "Update notification email sent"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });

  }

};

exports.sendVendorPassLink = async (req, res) => {

  try {

    const {
      email,
      companyName,
      referenceNo,
      link,
      validUpto,
      departmentName
    } = req.body;

    if (!email || !link || !referenceNo) {
      return res.status(400).json({
        success: false,
        message: "email, link and referenceNo are required"
      });
    }

    await sendVendorPassLinkEmail({
      email,
      companyName,
      referenceNo,
      link,
      validUpto,
      departmentName
    });

    return res.json({
      success: true,
      message: "Vendor pass link email sent successfully"
    });

  } catch (error) {

    console.error("sendVendorPassLink error:", error);

    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });

  }

};

exports.sendPassReverted = async (req, res) => {

  try {

    const { email, name, referenceNumber, revertedEntities, revertedCount, formLink } = req.body;

    console.log(`[EMAIL-CTRL] Received pass reverted email request for ${email}`);
    console.log(`[EMAIL-CTRL] Payload:`, JSON.stringify(req.body, null, 2));

    if (!email || !referenceNumber || !revertedEntities) {
      console.log(`[EMAIL-CTRL] Missing required fields: email=${email}, referenceNumber=${referenceNumber}, revertedEntities=${revertedEntities}`);
      return res.status(400).json({
        success: false,
        message: "email, referenceNumber and revertedEntities are required"
      });
    }

    console.log(`[EMAIL-CTRL] Calling sendPassRevertedEmail for ${email}`);
    await sendPassRevertedEmail(email, name, referenceNumber, revertedEntities, revertedCount, formLink || null);

    console.log(`[EMAIL-CTRL] Email sent successfully to ${email}`);
    return res.json({
      success: true,
      message: "Pass reverted email sent successfully"
    });

  } catch (error) {

    console.error("[EMAIL-CTRL] sendPassReverted error:", error);
    console.error("[EMAIL-CTRL] Error stack:", error.stack);

    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });

  }

};

exports.sendVendorPassApproved = async (req, res) => {
  try {
    const {
      email,
      companyName,
      referenceNo,
      qrLink,
      approvedPersonsCount,
      approvedVehiclesCount,
      validUpto,
      departmentName,
      finalStatus
    } = req.body;

    console.log(`[EMAIL-CTRL] Received vendor pass email request for ${email}, status: ${finalStatus || 'APPROVED'}`);

    if (!email || !referenceNo || !qrLink) {
      return res.status(400).json({
        success: false,
        message: "email, referenceNo and qrLink are required"
      });
    }

    await sendVendorPassApprovedEmail({
      email,
      companyName,
      referenceNo,
      qrLink,
      approvedPersonsCount,
      approvedVehiclesCount,
      validUpto,
      departmentName,
      finalStatus: finalStatus || 'APPROVED'
    });

    console.log(`[EMAIL-CTRL] Vendor pass approved email sent to ${email}`);
    return res.json({
      success: true,
      message: "Vendor pass approved email sent successfully"
    });

  } catch (error) {
    console.error("[EMAIL-CTRL] sendVendorPassApproved error:", error);
    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });
  }
};

exports.sendVendorPassSubmitted = async (req, res) => {
  try {
    const { email, companyName, referenceNo, personsCount, vehiclesCount, departmentName } = req.body;

    if (!email || !referenceNo) {
      return res.status(400).json({
        success: false,
        message: "email and referenceNo are required"
      });
    }

    await sendVendorPassSubmittedEmail({ email, companyName, referenceNo, personsCount, vehiclesCount, departmentName });

    return res.json({
      success: true,
      message: "Vendor pass submission acknowledgement email sent successfully"
    });

  } catch (error) {
    console.error("[EMAIL-CTRL] sendVendorPassSubmitted error:", error);
    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });
  }
};

exports.sendForgotPasswordOTP = async (req, res) => {
  try {
    const { email, name, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "email and otp are required"
      });
    }

    await sendForgotPasswordOTPEmail(email, name || "User", otp);

    return res.json({
      success: true,
      message: "Forgot password OTP email sent successfully"
    });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendForgotPasswordOTP error:", error);
    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });
  }
};

exports.sendForgotPasswordOtp = async (req, res) => {

  try {

    const { email, name, otp } = req.body;

    await sendForgotPasswordOtpEmail(
      email,
      name,
      otp
    );

    return res.status(200).json({
      success: true,
      message: "Forgot password OTP email sent"
    });

  } catch (error) {

    console.error(
      "Forgot Password OTP Email Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP email"
    });

  }

};

// ── Bulk Pass Email Controllers ──────────────────────────────────────────────

exports.sendBulkPassInvitation = async (req, res) => {
  try {
    const { email, refNo } = req.body;
    if (!email || !refNo) {
      return res.status(400).json({ success: false, message: "email and refNo are required" });
    }
    await sendBulkPassInvitationEmail(req.body);
    return res.json({ success: true, message: "Bulk pass invitation email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendBulkPassInvitation error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendBulkPassSubmitted = async (req, res) => {
  try {
    const { email, refNo } = req.body;
    if (!email || !refNo) {
      return res.status(400).json({ success: false, message: "email and refNo are required" });
    }
    await sendBulkPassSubmittedEmail(req.body);
    return res.json({ success: true, message: "Bulk pass submitted email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendBulkPassSubmitted error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendBulkPassUnderReview = async (req, res) => {
  try {
    const { email, refNo } = req.body;
    if (!email || !refNo) {
      return res.status(400).json({ success: false, message: "email and refNo are required" });
    }
    await sendBulkPassUnderReviewEmail(req.body);
    return res.json({ success: true, message: "Bulk pass under review email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendBulkPassUnderReview error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendBulkPassReturned = async (req, res) => {
  try {
    const { email, refNo } = req.body;
    if (!email || !refNo) {
      return res.status(400).json({ success: false, message: "email and refNo are required" });
    }
    await sendBulkPassReturnedEmail(req.body);
    return res.json({ success: true, message: "Bulk pass returned email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendBulkPassReturned error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendBulkPassApproved = async (req, res) => {
  try {
    const { email, refNo } = req.body;
    if (!email || !refNo) {
      return res.status(400).json({ success: false, message: "email and refNo are required" });
    }
    await sendBulkPassApprovedEmail(req.body);
    return res.json({ success: true, message: "Bulk pass approved email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendBulkPassApproved error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendBulkPassRejected = async (req, res) => {
  try {
    const { email, refNo } = req.body;
    if (!email || !refNo) {
      return res.status(400).json({ success: false, message: "email and refNo are required" });
    }
    await sendBulkPassRejectedEmail(req.body);
    return res.json({ success: true, message: "Bulk pass rejected email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendBulkPassRejected error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendBulkPassRejectedPersons = async (req, res) => {
  try {
    const { email, refNo } = req.body;
    if (!email || !refNo) {
      return res.status(400).json({ success: false, message: "email and refNo are required" });
    }
    await sendBulkPassRejectedPersonsEmail(req.body);
    return res.json({ success: true, message: "Bulk pass rejected persons email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendBulkPassRejectedPersons error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendProfileUpdateSubmitted = async (req, res) => {
  try {
    await sendProfileUpdateSubmittedEmail(req.body);
    return res.json({ success: true, message: "Profile update submission email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendProfileUpdateSubmitted error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendProfileUpdateApproved = async (req, res) => {
  try {
    await sendProfileUpdateApprovedEmail(req.body);
    return res.json({ success: true, message: "Profile update approval email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendProfileUpdateApproved error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendProfileUpdateReverted = async (req, res) => {
  try {
    await sendProfileUpdateRevertedEmail(req.body);
    return res.json({ success: true, message: "Profile update revert email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendProfileUpdateReverted error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendProfileUpdateRejected = async (req, res) => {
  try {
    await sendProfileUpdateRejectedEmail(req.body);
    return res.json({ success: true, message: "Profile update rejection email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendProfileUpdateRejected error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendLicenseExpiryWarning = async (req, res) => {
  try {
    await sendLicenseExpiryWarningEmail(req.body);
    return res.json({ success: true, message: "License expiry warning email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendLicenseExpiryWarning error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendTwoWheelerUpdateSubmitted = async (req, res) => {
  try {
    await sendTwoWheelerUpdateSubmittedEmail(req.body);
    return res.json({ success: true, message: "Two-wheeler update submission email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendTwoWheelerUpdateSubmitted error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendTwoWheelerUpdateApproved = async (req, res) => {
  try {
    await sendTwoWheelerUpdateApprovedEmail(req.body);
    return res.json({ success: true, message: "Two-wheeler update approval email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendTwoWheelerUpdateApproved error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

exports.sendTwoWheelerUpdateRejected = async (req, res) => {
  try {
    await sendTwoWheelerUpdateRejectedEmail(req.body);
    return res.json({ success: true, message: "Two-wheeler update rejection email sent" });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendTwoWheelerUpdateRejected error:", error);
    res.status(500).json({ success: false, message: "Email sending failed" });
  }
};

// ── Multiple Pass Submissions Email Controllers ──────────────────────────────

exports.sendOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "email and otp are required"
      });
    }

    console.log(`[EMAIL-CTRL] Received OTP email request for ${email}`);
    await sendOTPEmail(email, otp);
    
    console.log(`[EMAIL-CTRL] OTP email sent successfully to ${email}`);
    return res.json({
      success: true,
      message: "OTP email sent successfully"
    });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendOTP error:", error);
    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });
  }
};

exports.sendPublicRequestAcknowledgment = async (req, res) => {
  try {
    const { applicantEmail, trackingNumber } = req.body;
    
    if (!applicantEmail || !trackingNumber) {
      return res.status(400).json({
        success: false,
        message: "applicantEmail and trackingNumber are required"
      });
    }

    console.log(`[EMAIL-CTRL] Received public request acknowledgment for ${applicantEmail}`);
    await sendPublicRequestAcknowledgment(req.body);
    
    console.log(`[EMAIL-CTRL] Public request acknowledgment sent to ${applicantEmail}`);
    return res.json({
      success: true,
      message: "Public request acknowledgment email sent successfully"
    });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendPublicRequestAcknowledgment error:", error);
    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });
  }
};

exports.sendAdminNotification = async (req, res) => {
  try {
    const { trackingNumber, companyName } = req.body;
    
    if (!trackingNumber || !companyName) {
      return res.status(400).json({
        success: false,
        message: "trackingNumber and companyName are required"
      });
    }

    console.log(`[EMAIL-CTRL] Received admin notification request for ${trackingNumber}`);
    await sendAdminNotification(req.body);
    
    console.log(`[EMAIL-CTRL] Admin notification sent for ${trackingNumber}`);
    return res.json({
      success: true,
      message: "Admin notification email sent successfully"
    });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendAdminNotification error:", error);
    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });
  }
};

exports.sendApprovalNotification = async (req, res) => {
  try {
    const { applicantEmail, uploadLink, validityFrom, validityUpto } = req.body;
    
    if (!applicantEmail || !uploadLink || !validityFrom || !validityUpto) {
      return res.status(400).json({
        success: false,
        message: "applicantEmail, uploadLink, validityFrom, and validityUpto are required"
      });
    }

    console.log(`[EMAIL-CTRL] Received approval notification request for ${applicantEmail}`);
    await sendApprovalNotification(req.body);
    
    console.log(`[EMAIL-CTRL] Approval notification sent to ${applicantEmail}`);
    return res.json({
      success: true,
      message: "Approval notification email sent successfully"
    });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendApprovalNotification error:", error);
    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });
  }
};

exports.sendRejectionNotification = async (req, res) => {
  try {
    const { applicantEmail, rejectionReason } = req.body;
    
    if (!applicantEmail || !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "applicantEmail and rejectionReason are required"
      });
    }

    console.log(`[EMAIL-CTRL] Received rejection notification request for ${applicantEmail}`);
    await sendRejectionNotification(req.body);
    
    console.log(`[EMAIL-CTRL] Rejection notification sent to ${applicantEmail}`);
    return res.json({
      success: true,
      message: "Rejection notification email sent successfully"
    });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendRejectionNotification error:", error);
    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });
  }
};

exports.sendChildBatchConfirmation = async (req, res) => {
  try {
    const { applicantEmail, refNo, submissionNumber } = req.body;
    
    if (!applicantEmail || !refNo || !submissionNumber) {
      return res.status(400).json({
        success: false,
        message: "applicantEmail, refNo, and submissionNumber are required"
      });
    }

    console.log(`[EMAIL-CTRL] Received child batch confirmation request for ${applicantEmail}`);
    await sendChildBatchConfirmation(req.body);
    
    console.log(`[EMAIL-CTRL] Child batch confirmation sent to ${applicantEmail}`);
    return res.json({
      success: true,
      message: "Child batch confirmation email sent successfully"
    });
  } catch (error) {
    console.error("[EMAIL-CTRL] sendChildBatchConfirmation error:", error);
    res.status(500).json({
      success: false,
      message: "Email sending failed"
    });
  }
};
