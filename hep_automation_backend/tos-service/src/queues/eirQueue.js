const { Queue, Worker, QueueEvents } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");
const { TosEirRecord } = require("../../models");

const QUEUE_NAME = "tosEirQueue";

const eirQueueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redisConnection,
});

const eirQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour for monitoring
      count: 1000, // Keep last 1000 jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours for audit
    },
  },
});

const eirWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const {
      eirNo,
      terminal,
      inGateDateTime,
      outGateDateTime,
      containerNumber,
      containerISO,
      containerSize,
      movementType,
      fullEmpty,
      line,
      trailerNumber,
      oocStatus,
      destinationGroup,
      destinationName,
      markedForScanning,
      createdBy,
    } = job.data;

    // Deduplicate: check if record with same eirNo AND containerNumber already exists
    const existing = await TosEirRecord.findOne({
      where: {
        eirNo,
        containerNumber,
      },
    });

    if (existing) {
      console.log(`[EIR Queue Worker] Record with eirNo '${eirNo}' and container '${containerNumber}' already exists. Skipping duplicate insert.`);
      return { skipped: true, reason: "Duplicate eirNo and containerNumber", eirNo, containerNumber };
    }

    try {
      const record = await TosEirRecord.create({
        eirNo,
        terminal,
        inGateDateTime,
        outGateDateTime: outGateDateTime || null,
        containerNumber,
        containerISO,
        containerSize,
        movementType,
        fullEmpty,
        line,
        trailerNumber,
        oocStatus: oocStatus || null,
        destinationGroup: destinationGroup || null,
        destinationName: destinationName || null,
        markedForScanning: markedForScanning || null,
        createdBy,
      });

      console.log(`[EIR Queue Worker] Successfully created EIR record id=${record.id}, eirNo='${eirNo}', container='${containerNumber}'`);
      return { success: true, id: record.id, eirNo, containerNumber };
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        console.log(`[EIR Queue Worker] Duplicate constraint caught for eirNo '${eirNo}' and container '${containerNumber}'. Skipping.`);
        return { skipped: true, reason: "SequelizeUniqueConstraintError", eirNo, containerNumber };
      }
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 10, // Process max 10 concurrent requests simultaneously to protect DB
  },
);

eirWorker.on("completed", (job, result) => {
  if (result?.skipped) {
    console.log(`[EIR Queue] Job ${job.id} skipped duplicate: ${result.reason}`);
  } else {
    console.log(`[EIR Queue] Job ${job.id} completed successfully for eirNo: ${job.data.eirNo}`);
  }
});

eirWorker.on("failed", (job, err) => {
  console.error(`[EIR Queue] Job ${job?.id} failed with error:`, err.message);
});

module.exports = {
  eirQueue,
  eirQueueEvents,
  eirWorker,
};
