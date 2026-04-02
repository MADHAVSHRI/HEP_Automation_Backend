const { Kafka } = require("kafkajs");
const axios = require("axios");

const kafka = new Kafka({
  clientId: "email-service",
  brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "email-group" });

const startConsumer = async () => {

  await consumer.connect();

  await consumer.subscribe({
    topic: "agent-registration-email",
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

          await axios.post(
            url,
            {
              email: data.email,
              name: data.name,
              referenceNumber: data.referenceNumber
            },
            {
              headers: {
                "x-service-name": "EMAIL-SERVICE"
              }
            }
          );

          console.log("Email sent successfully");

          /*
          ======================================================
          ADDED: UPDATE USER SERVICE EMAIL STATUS AFTER SUCCESS
          ======================================================
          */

          try {

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

              console.log("User-service email status updated successfully");

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
