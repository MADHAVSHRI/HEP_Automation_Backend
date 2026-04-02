const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "user-service",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();

const sendEmailEvent = async (payload) => {
  try {
    await producer.connect();

    await producer.send({
      topic: "agent-registration-email",
      messages: [
        {
          value: JSON.stringify(payload),
        },
      ],
    });

    await producer.disconnect();

    console.log("Email event pushed to Kafka");
  } catch (error) {
    console.error("Kafka Producer Error:", error.message);
  }
};

module.exports = sendEmailEvent;