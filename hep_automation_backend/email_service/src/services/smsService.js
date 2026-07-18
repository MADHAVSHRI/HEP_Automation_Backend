const axios = require("axios");
const crypto = require("crypto");

/*
=========================================================
Generate SHA-512 Hash
=========================================================
*/
const generateHash = (
  username,
  senderId,
  message,
  secureKey
) => {

  return crypto
    .createHash("sha512")
    .update(
      username.trim() +
      senderId.trim() +
      message.trim() +
      secureKey.trim()
    )
    .digest("hex");

};

const sendSMS = async (
  mobileNumber,
  message
) => {

  try {

    const username = process.env.SMS_USERNAME;
    const password = process.env.SMS_PASSWORD;
    const senderId = process.env.SMS_SENDER_ID;
    const secureKey = process.env.SMS_SECURE_KEY;
    const templateId = process.env.SMS_TEMPLATE_ID;
    const smsUrl = process.env.SMS_URL;

    if (
      !username ||
      !password ||
      !senderId ||
      !secureKey ||
      !templateId ||
      !smsUrl
    ) {

      throw new Error("SMS ENV variables missing");

    }

    /*
    =========================================================
    Generate Hash
    =========================================================
    */

    const key = generateHash(
      username,
      senderId,
      message,
      secureKey
    );

    /*
    =========================================================
    Prepare Payload
    =========================================================
    */

    const payload = new URLSearchParams({

      username: username.trim(),

      // Working Node project sends plain password
      password: password.trim(),

      senderid: senderId.trim(),

      content: message.trim(),

      smsservicetype: "singlemsg",

      mobileno: mobileNumber.trim(),

      key: key,

      templateid: templateId.trim()

    });

    /*
    =========================================================
    Debug Logs
    =========================================================
    */

    console.log("========== SMS REQUEST ==========");

    console.log({
      username,
      senderId,
      templateId,
      secureKey,
      mobileNumber
    });

    console.log("Generated Key :", key);

    console.log("Message :", message);

    console.log("Payload :");
    console.log("Template ID :", templateId);

    console.log(payload.toString());

    console.log("===============================");

    /*
    =========================================================
    Call SMS API
    =========================================================
    */

    const response = await axios.post(

      smsUrl,

      payload.toString(),

      {
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        timeout: 10000
      }

    );

    console.log("SMS Response :", response.data);

    return response.data;

  } catch (err) {

    console.error("SMS Error :", err.message);

    if (err.response) {

      console.error("Response :", err.response.data);

    }

    throw err;

  }

};

module.exports = {
  sendSMS
};

























// const axios = require("axios");
// const crypto = require("crypto");

// /*
// =========================================================
// PASSWORD ENCRYPTION
// (Java uses SHA-1 even though method name is MD5)
// =========================================================
// */
// const encryptPassword = (value) => {

//   return crypto
//     .createHash("sha1")
//     .update(value.trim(), "latin1") // ISO-8859-1
//     .digest("hex");

// };

// /*
// =========================================================
// HASH GENERATOR
// Matches Java hashGenerator()
// =========================================================
// */
// const generateHash = (
//   username,
//   senderId,
//   message,
//   secureKey
// ) => {

//   return crypto
//     .createHash("sha512")
//     .update(
//       username.trim() +
//       senderId.trim() +
//       message.trim() +
//       secureKey.trim(),
//       "latin1"
//     )
//     .digest("hex");

// };

// const sendSMS = async (
//   mobileNumber,
//   message
// ) => {

//   try {

//     const username = process.env.SMS_USERNAME;
//     const password = process.env.SMS_PASSWORD;
//     const senderId = process.env.SMS_SENDER_ID;
//     const secureKey = process.env.SMS_SECURE_KEY;
//     const templateId = process.env.SMS_TEMPLATE_ID;
//     const smsUrl = process.env.SMS_URL;

//     if (
//       !username ||
//       !password ||
//       !senderId ||
//       !secureKey ||
//       !templateId ||
//       !smsUrl
//     ) {

//       throw new Error("SMS ENV variables missing");

//     }

//     /*
//     =========================================================
//     PASSWORD ENCRYPTION
//     =========================================================
//     */

//     const encryptedPassword =
//       encryptPassword(password);

//     /*
//     =========================================================
//     HASH KEY
//     =========================================================
//     */

//     const key =
//       generateHash(
//         username,
//         senderId,
//         message,
//         secureKey
//       );

//     /*
//     =========================================================
//     REQUEST PARAMETERS
//     =========================================================
//     */

//     const params =
//       new URLSearchParams();

//     params.append(
//       "mobileno",
//       mobileNumber
//     );

//     params.append(
//       "senderid",
//       senderId
//     );

//     params.append(
//       "content",
//       message
//     );

//     params.append(
//       "smsservicetype",
//       "singlemsg"
//     );

//     params.append(
//       "username",
//       username
//     );

//     params.append(
//       "password",
//       encryptedPassword
//     );

//     params.append(
//       "key",
//       key
//     );

//     params.append(
//       "templateid",
//       templateId
//     );

//     /*
//     =========================================================
//     DEBUG LOGS
//     =========================================================
//     */

//     console.log("SMS Request");

//     console.log({
//       username,
//       senderId,
//       templateId,
//       secureKey,
//       mobileNumber
//     });

//     console.log(
//       "Encrypted Password:",
//       encryptedPassword
//     );

//     console.log(
//       "Generated Key:",
//       key
//     );

//     console.log(
//       "Message:",
//       message
//     );

//     console.log(
//       "Payload:",
//       params.toString()
//     );

//     /*
//     =========================================================
//     SMS API
//     =========================================================
//     */

//     const response =
//       await axios.post(
//         smsUrl,
//         params,
//         {
//           headers: {
//             "Content-Type":
//               "application/x-www-form-urlencoded"
//           }
//         }
//       );

//     console.log(
//       "SMS Response:",
//       response.data
//     );

//     return response.data;

//   } catch (err) {

//     console.error(
//       "SMS Error:",
//       err.message
//     );

//     throw err;

//   }

// };

// module.exports = {
//   sendSMS
// };
