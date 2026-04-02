const { sendReferenceEmail } = require("../services/emailService");

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