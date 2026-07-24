const { Kafka } = require("kafkajs");
const axios = require("axios");

const kafka = new Kafka({
  clientId: "email-service",
  brokers: ["localhost:9092"],
  retry: {
    initialRetryTime: 300,
    retries: 10
  }
});

const consumer = kafka.consumer({ groupId: "email-group" });

const startConsumer = async () => {

  await consumer.connect();

  await consumer.subscribe({
    topic: "agent-registration-email",
    fromBeginning: true,
  });
  await consumer.subscribe({
    topic: "deptUser-events",
    fromBeginning: true,
  });
  await consumer.subscribe({
    topic: "appointment-sms",
    fromBeginning: true
  });

  await consumer.run({

    eachMessage: async ({ message }) => {

      if (!message || message.value == null) {
        console.warn("Kafka message or message.value is null; skipping");
        return;
      }

      let data;

      try {
        data = JSON.parse(message.value.toString());
      } catch (err) {
        console.error("Failed to parse Kafka message value as JSON:", err.message);
        return;
      }

      console.log("Kafka Email Event Received:", data);

      if (data.type === "agent-registration-sms") {

  try {
    const url = process.env.EMAIL_SERVICE_URL;
    if (!url) {
      console.error("EMAIL_SERVICE_URL not configured");
      return;
    }
    await axios.post(
      `${url}/api/sms/sendRegistrationSms`,
      {
        mobileNumber: data.mobileNumber,
        username: data.username,
        requestId: data.requestId,
        status: data.status,
        date: new Date().toLocaleDateString()
      },
      {
        headers: {
          "x-service-name": "EMAIL-SERVICE"
        }
      }
    );

    console.log("Registration SMS sent successfully");

  } catch (smsError) {

    console.error(
      "SMS sending failed:",
      smsError.message
    );

  }

  return;
}

      try {

        const url = process.env.EMAIL_SERVICE_URL;

        if (!url) {

          console.error("EMAIL_SERVICE_URL is not set; skipping email send");

        } else {

          /*
          ======================================================
          🔧 CHANGE 1
          Build payload based on email type
          ======================================================
          */

          let payload;

          if (data.type === "APPROVAL") {

            payload = {
              email: data.email,
              name: data.name,
              loginId: data.loginId,
              password: data.password
            };

          } else if (data.type === "REJECTION") {

            payload = {
              email: data.email,
              name: data.name,
              referenceNumber: data.referenceNumber,
              reason: data.reason
            };

          } else if (data.type === "REVERTED") {
            payload = {
              email: data.email,
              name: data.name,
              referenceNumber: data.referenceNumber,
              reason: data.reason
            };

          } else if (data.type === "FORGOT_PASSWORD_OTP") {
            payload = {
              email: data.email,
              name: data.name,
              otp: data.otp
            };
          } else if (data.type === "UPDATED_AFTER_REVERT") {

            payload = {
              email: data.email,
              name: data.name,
              referenceNumber: data.referenceNumber
            };

          } else if (data.type === "DEPT_USER_CREATED") {

            payload = {
              email: data.email,
              name: data.name,
              status: data.status
            };

          }else if (data.type === "DEPT_USER_ACTIVATED") {

            payload = {
              email: data.email,
              name: data.name,
              status: data.status
            };

          } else if (data.type === "DEPT_USER_DISABLED") {

            payload = {
              email: data.email,
              name: data.name,
              status: data.status
            };

          } else if (data.type === "PROFILE_UPDATE_SUBMITTED" || data.type === "PROFILE_UPDATE_APPROVED") {

            payload = {
              email: data.email,
              name: data.name,
              referenceNumber: data.referenceNumber,
            };

          } else if (data.type === "PROFILE_UPDATE_REVERTED" || data.type === "PROFILE_UPDATE_REJECTED") {

            payload = {
              email: data.email,
              name: data.name,
              referenceNumber: data.referenceNumber,
              rejectedReason: data.rejectedReason || data.reason,
            };

          } else if (data.type === "LICENSE_EXPIRY_WARNING") {

            payload = {
              email: data.email,
              name: data.name,
              licenseNumber: data.licenseNumber,
              licenseValidityDate: data.licenseValidityDate,
              daysRemaining: data.daysRemaining,
            };

          } else if (data.type === "OVERSTAY_REMINDER") {

            payload = {
              email: data.email,
              company_name: data.company_name,
              identifier: data.identifier,
              entity_type: data.entity_type,
              pass_no: data.pass_no,
              date_to: data.date_to,
              overstay_days: data.overstay_days,
              total_amount: data.total_amount,
              charge_id: data.charge_id
            };

          } else {
            // Registration email (existing logic)
            payload = {
              email: data.email,
              name: data.name,
              referenceNumber: data.referenceNumber
            };

          }

          /*
          ======================================================
          EXISTING EMAIL SERVICE CALL (UNCHANGED)
          ======================================================
          */

          /*
======================================================
🔧 CHANGE — Call correct email API based on type
======================================================
*/

    let emailApi = "";

    if (data.type === "APPROVAL") {

      emailApi = "/api/email/sendApproval";

    } else if (data.type === "REJECTION") {

      emailApi = "/api/email/sendRejection";

    } else if (data.type === "REVERTED") {

        emailApi = "/api/email/sendReverted";

    }else if (data.type === "UPDATED_AFTER_REVERT") {

        emailApi = "/api/email/sendUpdatedAfterRevert";

    }else if (data.type === "FORGOT_PASSWORD_OTP") {

        emailApi = "/api/email/sendForgotPasswordOtp";

    }else if (data.type === "DEPT_USER_CREATED") {

        emailApi = "/api/email/sendDeptUserCreated";

    }else if (data.type === "DEPT_USER_ACTIVATED") {

        emailApi = "/api/email/sendDeptUserActivated";

    }else if (data.type === "DEPT_USER_DISABLED") {

        emailApi = "/api/email/sendDeptUserDisabled";

    }else if (data.type === "PROFILE_UPDATE_SUBMITTED") {

        emailApi = "/api/email/sendProfileUpdateSubmitted";

    }else if (data.type === "PROFILE_UPDATE_APPROVED") {

        emailApi = "/api/email/sendProfileUpdateApproved";

    }else if (data.type === "PROFILE_UPDATE_REVERTED") {

        emailApi = "/api/email/sendProfileUpdateReverted";

    }else if (data.type === "PROFILE_UPDATE_REJECTED") {

        emailApi = "/api/email/sendProfileUpdateRejected";

    }else if (data.type === "LICENSE_EXPIRY_WARNING") {

        emailApi = "/api/email/sendLicenseExpiryWarning";

    }else if (data.type === "OVERSTAY_REMINDER") {

        emailApi = "/api/email/sendOverstayReminder";

    }else {

      emailApi = "/api/email/sendReferenceNo";

    }

    await axios.post(
      `${process.env.EMAIL_SERVICE_URL}${emailApi}`,
      payload,
      {
        headers: {
          "x-service-name": "EMAIL-SERVICE"
        }
      }
    );

          console.log("Email sent successfully");

          /*
          ======================================================
          🔧 CHANGE 2
          UPDATE USER SERVICE AFTER EMAIL SUCCESS
          ======================================================
          */

          try {

            /*
            ------------------------------------------------------
            CASE 1: Registration Email
            ------------------------------------------------------
            */

            if (data.referenceNumber) {

              const updateUrl = process.env.USER_SERVICE_UPDATE_EMAIL_STATUS_URL;

              if (!updateUrl) {

                console.warn("USER_SERVICE_UPDATE_EMAIL_STATUS_URL not set");

              } else {

                await axios.patch(
                  updateUrl,
                  {
                    referenceNumber: data.referenceNumber
                  },
                  {
                    headers: {
                      "x-service-name": "EMAIL-SERVICE"
                    }
                  }
                );

                console.log("Reference email status updated");

              }

            }

            /*
            ------------------------------------------------------
            CASE 2: Approval Credentials Email
            ------------------------------------------------------
            */

            if (data.agentId) {

              const updateCredentialUrl =
                process.env.USER_SERVICE_UPDATE_CREDENTIAL_STATUS_URL;

              if (!updateCredentialUrl) {

                console.warn("USER_SERVICE_UPDATE_CREDENTIAL_STATUS_URL not set");

              } else {

                await axios.patch(
                  updateCredentialUrl,
                  {
                    agentId: data.agentId
                  },
                  {
                    headers: {
                      "x-service-name": "EMAIL-SERVICE"
                    }
                  }
                );

                console.log("Credential email status updated");

              }

            }

          } catch (updateError) {

            console.error(
              "Failed to update user-service email status:",
              updateError.message
            );

          }

        }

      } catch (error) {

        console.error("Email sending failed:", error.message);

      }

    }

  });

};

module.exports = startConsumer;



































// const { Kafka } = require("kafkajs");
// const axios = require("axios");

// const kafka = new Kafka({
//   clientId: "email-service",
//   brokers: ["localhost:9092"],
//   retry: {
//     initialRetryTime: 300,
//     retries: 10
//   }
// });

// const consumer = kafka.consumer({ groupId: "email-group" });

// const startConsumer = async () => {

//   await consumer.connect();

//   await consumer.subscribe({
//     topic: "agent-registration-email",
//     fromBeginning: true,
//   });

//   await consumer.run({

//     eachMessage: async ({ message }) => {

//       if (!message || message.value == null) {
//         console.warn("Kafka message or message.value is null; skipping");
//         return;
//       }

//       let data;

//       try {
//         data = JSON.parse(message.value.toString());
//       } catch (err) {
//         console.error("Failed to parse Kafka message value as JSON:", err.message);
//         return;
//       }

//       console.log("Kafka Email Event Received:", data);

//       try {

//         const url = process.env.EMAIL_SERVICE_URL;

//         if (!url) {

//           console.error("EMAIL_SERVICE_URL is not set; skipping email send");

//         } else {

//           await axios.post(
//             url,
//             {
//               email: data.email,
//               name: data.name,
//               referenceNumber: data.referenceNumber
//             },
//             {
//               headers: {
//                 "x-service-name": "EMAIL-SERVICE"
//               }
//             }
//           );

//           console.log("Email sent successfully");

//           /*
//           ======================================================
//           ADDED: UPDATE USER SERVICE EMAIL STATUS AFTER SUCCESS
//           ======================================================
//           */

//           try {

//             const updateUrl = process.env.USER_SERVICE_UPDATE_EMAIL_STATUS_URL;

//             if (!updateUrl) {

//               console.warn("USER_SERVICE_UPDATE_EMAIL_STATUS_URL not set");

//             } else {

//               await axios.patch(
//                 updateUrl,
//                 {
//                   referenceNumber: data.referenceNumber
//                 },
//                 {
//                   headers: {
//                     "x-service-name": "EMAIL-SERVICE"
//                   }
//                 }
//               );

//               console.log("User-service email status updated successfully");

//             }

//           } catch (updateError) {

//             console.error(
//               "Failed to update user-service email status:",
//               updateError.message
//             );

//           }

//         }

//       } catch (error) {

//         console.error("Email sending failed:", error.message);

//       }

//     }

//   });

// };

// module.exports = startConsumer;






























// const { Kafka } = require("kafkajs");
// const axios = require("axios");

// const kafka = new Kafka({
//   clientId: "email-service",
//   brokers: ["localhost:9092"],
// });

// const consumer = kafka.consumer({ groupId: "email-group" });

// const startConsumer = async () => {
//   await consumer.connect();

//   await consumer.subscribe({
//     topic: "agent-registration-email",
//     fromBeginning: true,
//   });

//   await consumer.run({

//   eachMessage: async ({ message }) => {

//     if (!message || message.value == null) {
//       console.warn("Kafka message or message.value is null; skipping");
//       return;
//     }

//     let data;
//     try {
//       data = JSON.parse(message.value.toString());
//     } catch (err) {
//       console.error("Failed to parse Kafka message value as JSON:", err.message);
//       return;
//     }

//     console.log("Kafka Email Event Received:", data);

//     try {

//       const url = process.env.EMAIL_SERVICE_URL;
//       if (!url) {
//         console.error("EMAIL_SERVICE_URL is not set; skipping email send");
//       } else {
//         await axios.post(url, {
//           email: data.email,
//           name: data.name,
//           referenceNumber: data.referenceNumber
//         });

//         console.log("Email sent successfully");
//       }

//     } catch (error) {

//       console.error("Email sending failed:", error.message);

//     }

//   }

// });
// };

// module.exports = startConsumer;
