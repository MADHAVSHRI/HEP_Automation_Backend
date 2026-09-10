const { Queue, Worker, QueueEvents } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");
const { CustomsOoc } = require("../../models");

const QUEUE_NAME = "customsOocQueue";

const oocQueueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redisConnection,
});

const oocQueue = new Queue(QUEUE_NAME, {
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

const oocWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const {
      containerNumber,
      containerSize,
      oocStatus,
      oocNumber,
      dateTime,
      receivedBy,
    } = job.data;

    const existing = await CustomsOoc.findOne({
      where: { oocNumber },
    });

    if (existing) {
      console.log(`[OOC Queue Worker] Duplicate OOC transaction for oocNumber '${oocNumber}'. Skipping.`);
      return { skipped: true, reason: "Duplicate OOC transaction", id: existing.id };
    }

    try {
      const record = await CustomsOoc.create({
        containerNumber,
        containerSize,
        oocStatus,
        oocNumber,
        dateTime: new Date(dateTime),
        receivedBy,
      });

      console.log(`[OOC Queue Worker] Saved OOC record id=${record.id}, oocNumber='${oocNumber}'`);
      return {
        success: true,
        id: record.id,
        containerNumber: record.containerNumber,
        containerSize: record.containerSize,
        oocStatus: record.oocStatus,
        oocNumber: record.oocNumber,
        dateTime: record.dateTime,
        receivedAt: record.createdAt,
      };
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

oocWorker.on("completed", (job, result) => {
  if (result?.skipped) {
    console.log(`[OOC Queue] Job ${job.id} skipped duplicate: ${result.reason}`);
  } else {
    console.log(`[OOC Queue] Job ${job.id} completed for oocNumber: ${job.data.oocNumber}`);
  }
});

oocWorker.on("failed", (job, err) => {
  console.error(`[OOC Queue] Job ${job?.id} failed:`, err.message);
});

module.exports = {
  oocQueue,
  oocQueueEvents,
  oocWorker,
};
