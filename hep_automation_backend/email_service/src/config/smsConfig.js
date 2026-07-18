require("dotenv").config();
module.exports = {
  username: process.env.SMS_USERNAME,
  password: process.env.SMS_PASSWORD,
  senderId: process.env.SMS_SENDER_ID,
  secureKey: process.env.SMS_SECURE_KEY,
  templateId: process.env.SMS_TEMPLATE_ID,
  smsUrl:
    "https://msdgweb.mgov.gov.in/esms/sendsmsrequestDLT"
};