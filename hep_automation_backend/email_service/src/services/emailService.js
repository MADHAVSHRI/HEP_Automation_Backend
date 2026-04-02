const transporter = require("../config/emailConfig");
const template = require("../emailTemplates/referenceNumberTemplate");

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

module.exports = { sendReferenceEmail };