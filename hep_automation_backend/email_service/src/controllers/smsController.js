const {
  sendSMS
} = require("../services/smsService");

const registrationTemplate =
require("../smsTemplates/registrationTemplate");

const sendRegistrationSMS =
async (req, res) => {

  try {

    const {
      mobileNumber,
      username,
      requestId,
      status,
      date
    } = req.body;

    const message =
      registrationTemplate(
        username,
        requestId,
        status,
        date
      );
//     const message =
// "Dear Candidate, use this OTP 123456 to verify your mobile number to start your application for Directorate General of Shipping. Team C-DAC";

    const response = await sendSMS(
    mobileNumber,
    message
    );

    if (
        typeof response === "string" &&
        response.startsWith("402")
    ) {

        console.log("SMS accepted by gateway");

    } else {

        console.error("SMS Gateway Error:", response);

    }

    return res.status(200).json({
        success: true,
        response
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    });

  }

};

module.exports = {
  sendRegistrationSMS
};