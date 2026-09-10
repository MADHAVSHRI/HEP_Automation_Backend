const bcrypt = require("bcrypt");
const {
  CustomsOperator,
  CustomsExamination,
  CustomsRapiscan,
  CustomsOoc,
  sequelize,
} = require("../../models");
const { signToken } = require("../utils/jwt");
const { rapiscanQueue, rapiscanQueueEvents } = require("../queues/rapiscanQueue");
const { examinationQueue, examinationQueueEvents } = require("../queues/examinationQueue");
const { oocQueue, oocQueueEvents } = require("../queues/oocQueue");

async function loginOperator({ loginId, password }) {
  if (!loginId || !password) {
    const error = new Error("loginId and password are required");
    error.statusCode = 400;
    throw error;
  }

  const operator = await CustomsOperator.scope("withPassword").findOne({
    where: { loginId },
  });

  if (!operator || !(await bcrypt.compare(password, operator.password))) {
    const error = new Error("Invalid login ID or password");
    error.statusCode = 401;
    throw error;
  }

  if (!operator.isActive) {
    const error = new Error("Account is inactive");
    error.statusCode = 403;
    throw error;
  }

  const token = signToken({
    id: operator.id,
    loginId: operator.loginId,
  });

  return { token };
}

async function pushRapiscanRecord({ payload, operatorId }) {
  const containerNumber = payload.containerNumber.trim();
  const containerSize = payload.containerSize.trim();
  const scanningStatus = payload.scanningStatus.trim();
  const scanningDateTime = payload.scanningDateTime.trim();

  // Deduplication check
  const existing = await CustomsRapiscan.findOne({
    where: {
      containerNumber,
      scanningDateTime: new Date(scanningDateTime),
    },
  });

  if (existing) {
    return {
      status: "ALREADY_EXISTS",
      data: {
        containerNumber,
        containerSize,
        scanningStatus,
        scanningDateTime,
      },
      message: "Duplicate Rapiscan transaction",
    };
  }

  try {
    const job = await rapiscanQueue.add("pushRapiscanJob", {
      containerNumber,
      containerSize,
      scanningStatus,
      scanningDateTime,
      createdBy: operatorId,
    });

    const result = await job.waitUntilFinished(rapiscanQueueEvents, 5000);

    if (result?.skipped) {
      return {
        status: "ALREADY_EXISTS",
        data: {
          containerNumber,
          containerSize,
          scanningStatus,
          scanningDateTime,
        },
        message: "Duplicate Rapiscan transaction",
      };
    }

    return {
      status: "SUCCESS",
      data: {
        containerNumber,
        containerSize,
        scanningStatus,
        scanningDateTime,
      },
      message: "Rapiscan details received successfully.",
    };
  } catch (queueErr) {
    // Direct DB fallback if Redis is busy or offline
    try {
      await CustomsRapiscan.create({
        containerNumber,
        containerSize,
        scanningStatus,
        scanningDateTime: new Date(scanningDateTime),
        createdBy: operatorId,
      });

      return {
        status: "PROCESSED_DIRECTLY",
        data: {
          containerNumber,
          containerSize,
          scanningStatus,
          scanningDateTime,
        },
        message: "Rapiscan details received successfully.",
      };
    } catch (dbErr) {
      if (dbErr.name === "SequelizeUniqueConstraintError") {
        return {
          status: "ALREADY_EXISTS",
          data: {
            containerNumber,
            containerSize,
            scanningStatus,
            scanningDateTime,
          },
          message: "Duplicate Rapiscan transaction",
        };
      }
      throw dbErr;
    }
  }
}

async function submitExaminationRecord({ payload, operatorId }) {
  const containerNumber = payload.containerNumber.trim();
  const igmNumber = payload.igmNumber.trim();
  const dateOfExamination = payload.dateOfExamination.trim();
  const examinationFindings = payload.examinationFindings.trim();
  const discrepancyFound = payload.discrepancyFound.trim();

  // Duplicate check — same container + IGM combination
  const existing = await CustomsExamination.findOne({
    where: {
      containerNumber,
      igmNumber,
    },
  });

  if (existing) {
    return {
      status: "ALREADY_EXISTS",
      message: `Examination record already exists for container ${containerNumber}, IGM ${igmNumber}`,
    };
  }

  try {
    const job = await examinationQueue.add("submitExaminationJob", {
      containerNumber,
      igmNumber,
      dateOfExamination,
      examinationFindings,
      discrepancyFound,
      createdBy: operatorId,
    });

    const result = await job.waitUntilFinished(examinationQueueEvents, 5000);

    if (result?.skipped) {
      return {
        status: "ALREADY_EXISTS",
        message: `Examination record already exists for container ${containerNumber}, IGM ${igmNumber}`,
      };
    }

    return {
      status: "SUCCESS",
      data: {
        containerNumber: result.containerNumber || containerNumber,
        igmNumber: result.igmNumber || igmNumber,
        dateOfExamination: result.dateOfExamination || dateOfExamination,
        examinationFindings: result.examinationFindings || examinationFindings,
        discrepancyFound: result.discrepancyFound || discrepancyFound,
        createdAt: result.createdAt || new Date(),
      },
      message: "Customs examination details saved successfully.",
    };
  } catch (queueErr) {
    // Direct DB fallback
    try {
      const examination = await CustomsExamination.create({
        containerNumber,
        igmNumber,
        dateOfExamination,
        examinationFindings,
        discrepancyFound,
        createdBy: operatorId,
      });

      return {
        status: "PROCESSED_DIRECTLY",
        data: {
          containerNumber: examination.containerNumber,
          igmNumber: examination.igmNumber,
          dateOfExamination: examination.dateOfExamination,
          examinationFindings: examination.examinationFindings,
          discrepancyFound: examination.discrepancyFound,
          createdAt: examination.createdAt,
        },
        message: "Customs examination details saved successfully.",
      };
    } catch (dbErr) {
      if (dbErr.name === "SequelizeUniqueConstraintError") {
        return {
          status: "ALREADY_EXISTS",
          message: "Examination record with these details already exists",
        };
      }
      throw dbErr;
    }
  }
}

async function pushOocRecord({ payload, operatorId }) {
  const containerNumber = payload.containerNumber.trim();
  const containerSize = payload.containerSize.trim();
  const oocStatus = payload.oocStatus.trim();
  const oocNumber = payload.oocNumber.trim();
  const dateTime = payload.dateTime;

  // Duplicate check — oocNumber uniquely identifies an OOC transaction
  const existing = await CustomsOoc.findOne({
    where: { oocNumber },
  });

  if (existing) {
    return {
      status: "ALREADY_EXISTS",
      message: "Duplicate OOC transaction",
    };
  }

  try {
    const job = await oocQueue.add("pushOocJob", {
      containerNumber,
      containerSize,
      oocStatus,
      oocNumber,
      dateTime,
      receivedBy: operatorId,
    });

    const result = await job.waitUntilFinished(oocQueueEvents, 5000);

    if (result?.skipped) {
      return {
        status: "ALREADY_EXISTS",
        message: "Duplicate OOC transaction",
      };
    }

    return {
      status: "SUCCESS",
      data: {
        id: result.id,
        containerNumber: result.containerNumber || containerNumber,
        containerSize: result.containerSize || containerSize,
        oocStatus: result.oocStatus || oocStatus,
        oocNumber: result.oocNumber || oocNumber,
        dateTime: result.dateTime || dateTime,
        receivedAt: result.receivedAt || new Date(),
      },
      message: "OOC details received successfully.",
    };
  } catch (queueErr) {
    // Direct DB fallback
    try {
      const oocRecord = await CustomsOoc.create({
        containerNumber,
        containerSize,
        oocStatus,
        oocNumber,
        dateTime: new Date(dateTime),
        receivedBy: operatorId,
      });

      return {
        status: "PROCESSED_DIRECTLY",
        data: {
          id: oocRecord.id,
          containerNumber: oocRecord.containerNumber,
          containerSize: oocRecord.containerSize,
          oocStatus: oocRecord.oocStatus,
          oocNumber: oocRecord.oocNumber,
          dateTime: oocRecord.dateTime,
          receivedAt: oocRecord.createdAt,
        },
        message: "OOC details received successfully.",
      };
    } catch (dbErr) {
      if (dbErr.name === "SequelizeUniqueConstraintError") {
        return {
          status: "ALREADY_EXISTS",
          message: "Duplicate OOC transaction",
        };
      }
      throw dbErr;
    }
  }
}

module.exports = {
  loginOperator,
  pushRapiscanRecord,
  submitExaminationRecord,
  pushOocRecord,
};
