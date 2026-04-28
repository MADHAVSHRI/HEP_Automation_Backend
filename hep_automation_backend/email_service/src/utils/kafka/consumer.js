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

          }else if (data.type === "DEPT_USER_DISABLED") {

            payload = {
              email: data.email,
              name: data.name,
              status: data.status
            };

            }else {
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

    }else if (data.type === "DEPT_USER_CREATED") {

        emailApi = "/api/email/sendDeptUserCreated";

    }else if (data.type === "DEPT_USER_ACTIVATED") {

        emailApi = "/api/email/sendDeptUserActivated";

    }else if (data.type === "DEPT_USER_DISABLED") {

        emailApi = "/api/email/sendDeptUserDisabled";

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
