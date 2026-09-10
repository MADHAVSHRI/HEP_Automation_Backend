const { Queue, Worker, QueueEvents } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");
const { CustomsExamination } = require("../../models");

const QUEUE_NAME = "customsExaminationQueue";

const examinationQueueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redisConnection,
});

const examinationQueue = new Queue(QUEUE_NAME, {
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

const examinationWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const {
      containerNumber,
      igmNumber,
      dateOfExamination,
      examinationFindings,
      discrepancyFound,
      createdBy,
    } = job.data;

    const existing = await CustomsExamination.findOne({
      where: {
        containerNumber,
        igmNumber,
      },
    });

    if (existing) {
      console.log(`[Examination Queue Worker] Record for container '${containerNumber}', IGM '${igmNumber}' already exists.`);
      return { skipped: true, reason: "Duplicate Examination", id: existing.id, createdAt: existing.createdAt };
    }

    try {
      const record = await CustomsExamination.create({
        containerNumber,
        igmNumber,
        dateOfExamination,
        examinationFindings,
        discrepancyFound,
        createdBy,
      });

      console.log(`[Examination Queue Worker] Saved Examination record id=${record.id}, container='${containerNumber}'`);
      return {
        success: true,
        id: record.id,
        containerNumber: record.containerNumber,
        igmNumber: record.igmNumber,
        dateOfExamination: record.dateOfExamination,
        examinationFindings: record.examinationFindings,
        discrepancyFound: record.discrepancyFound,
        createdAt: record.createdAt,
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

examinationWorker.on("completed", (job, result) => {
  if (result?.skipped) {
    console.log(`[Examination Queue] Job ${job.id} skipped duplicate: ${result.reason}`);
  } else {
    console.log(`[Examination Queue] Job ${job.id} completed for container: ${job.data.containerNumber}`);
  }
});

examinationWorker.on("failed", (job, err) => {
  console.error(`[Examination Queue] Job ${job?.id} failed:`, err.message);
});

module.exports = {
  examinationQueue,
  examinationQueueEvents,
  examinationWorker,
};
