const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "approval-admin-service",
  brokers: ["localhost:9092"],
  retry: {
    initialRetryTime: 300,
    retries: 10
  }
});

const producer = kafka.producer();

let isConnected = false;

const connectProducer = async () => {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
    console.log("Kafka Producer Connected");
  }
};

const sendEmailEvent = async (payload) => {
  try {

    await connectProducer();

    await producer.send({
      topic: "deptUser-events",
      messages: [
        {
          value: JSON.stringify(payload),
        },
      ],
    });

    console.log("Kafka Email Event Sent");

  } catch (error) {
    console.error("Kafka Producer Error:", error.message);
  }
};

module.exports = sendEmailEvent;