const { Queue, Worker, QueueEvents } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");
const { CustomsRapiscan } = require("../../models");

const QUEUE_NAME = "customsRapiscanQueue";

const rapiscanQueueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redisConnection,
});

const rapiscanQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 86400,
    },
  },
});

const rapiscanWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const {
      containerNumber,
      containerSize,
      scanningStatus,
      scanningDateTime,
      createdBy,
    } = job.data;

    const existing = await CustomsRapiscan.findOne({
      where: {
        containerNumber,
        scanningDateTime: new Date(scanningDateTime),
      },
    });

    if (existing) {
      console.log(`[Rapiscan Queue Worker] Duplicate scan for container '${containerNumber}' at '${scanningDateTime}'. Skipping.`);
      return { skipped: true, reason: "Duplicate Rapiscan transaction", id: existing.id };
    }

    try {
      const record = await CustomsRapiscan.create({
        containerNumber,
        containerSize,
        scanningStatus,
        scanningDateTime: new Date(scanningDateTime),
        createdBy,
      });

      console.log(`[Rapiscan Queue Worker] Saved Rapiscan record id=${record.id}, container='${containerNumber}'`);
      return { success: true, id: record.id };
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        return { skipped: true, reason: "SequelizeUniqueConstraintError" };
      }
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  },
);

rapiscanWorker.on("completed", (job, result) => {
  if (result?.skipped) {
    console.log(`[Rapiscan Queue] Job ${job.id} skipped duplicate: ${result.reason}`);
  } else {
    console.log(`[Rapiscan Queue] Job ${job.id} completed for container: ${job.data.containerNumber}`);
  }
});

rapiscanWorker.on("failed", (job, err) => {
  console.error(`[Rapiscan Queue] Job ${job?.id} failed:`, err.message);
});

module.exports = {
  rapiscanQueue,
  rapiscanQueueEvents,
  rapiscanWorker,
};
