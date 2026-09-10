const { Queue, Worker, QueueEvents } = require("bullmq");
const { redisConnection } = require("../config/redisConfig");
const { TosForm13, TosForm13Container, sequelize } = require("../../models");

const QUEUE_NAME = "tosForm13Queue";

const form13QueueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redisConnection,
});

const form13Queue = new Queue(QUEUE_NAME, {
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

const form13Worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { form13No, terminal, trailerNumber, containers, createdBy, form13Id } = job.data;

    let form13 = null;
    if (form13Id) {
      form13 = await TosForm13.findByPk(form13Id);
    }
    if (!form13) {
      form13 = await TosForm13.findOne({ where: { form13No } });
    }

    const transaction = await sequelize.transaction();

    try {
      if (!form13) {
        form13 = await TosForm13.create(
          {
            form13No,
            terminal,
            trailerNumber,
            createdBy,
          },
          { transaction },
        );
      }

      // Check existing containers for this form13 to avoid duplicate container rows
      const existingRows = await TosForm13Container.findAll({
        where: { form13Id: form13.id },
        transaction,
      });

      const existingKeys = new Set(
        existingRows.map((r) =>
          `${(r.containerNumber || "").trim().toUpperCase()}_${(r.movementType || "").trim().toUpperCase()}`
        )
      );

      const newContainers = (containers || []).filter((item) => {
        const key = `${(item.containerNumber || "").trim().toUpperCase()}_${(item.movementType || "").trim().toUpperCase()}`;
        return !existingKeys.has(key);
      });

      if (newContainers.length === 0) {
        await transaction.rollback();
        console.log(`[Form13 Queue Worker] All container(s) for form13No '${form13No}' already exist. Skipping duplicate insert.`);
        return { skipped: true, reason: "Duplicate container in form13", form13No };
      }

      const rows = newContainers.map((item) => ({
        form13Id: form13.id,
        containerNumber: item.containerNumber || null,
        containerSize: item.containerSize || null,
        containerISO: item.containerISO || null,
        containerType: item.containerType && !item.containerType.includes("/") ? item.containerType : null,
        movementType: item.movementType,
      }));

      await TosForm13Container.bulkCreate(rows, { transaction });
      await transaction.commit();

      console.log(`[Form13 Queue Worker] Successfully saved Form13 id=${form13.id}, form13No='${form13No}', newContainers=${rows.length}`);
      return { success: true, id: form13.id, form13No, addedContainers: rows.length };
    } catch (error) {
      await transaction.rollback();
      if (error.name === "SequelizeUniqueConstraintError") {
        console.log(`[Form13 Queue Worker] Duplicate constraint caught for form13No '${form13No}'. Skipping.`);
        return { skipped: true, reason: "SequelizeUniqueConstraintError", form13No };
      }
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  },
);

form13Worker.on("completed", (job, result) => {
  if (result?.skipped) {
    console.log(`[Form13 Queue] Job ${job.id} skipped duplicate: ${result.reason}`);
  } else {
    console.log(`[Form13 Queue] Job ${job.id} completed successfully for form13No: ${job.data.form13No}`);
  }
});

form13Worker.on("failed", (job, err) => {
  console.error(`[Form13 Queue] Job ${job?.id} failed with error:`, err.message);
});

module.exports = {
  form13Queue,
  form13QueueEvents,
  form13Worker,
};
