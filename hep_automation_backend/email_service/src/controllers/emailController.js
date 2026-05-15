const { sendReferenceEmail, sendApprovalEmail, sendRejectionEmail, 
  sendDeptUserCreationEmail, sendDeptUserActivatedEmail, sendDeptUserDisabledEmail,
  sendRevertedAgentRequestEmail,sendUpdatedAfterRevertEmail,
  sendVendorPassLinkEmail } = require("../services/emailService");

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