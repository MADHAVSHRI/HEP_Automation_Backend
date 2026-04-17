const { sendReferenceEmail, sendApprovalEmail, sendRejectionEmail, sendDeptUserCreationEmail } = require("../services/emailService");

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
