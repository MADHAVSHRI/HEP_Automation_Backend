const bcrypt = require("bcrypt");
const {
  CustomsOperator,
  CustomsExamination,
  CustomsRapiscan,
  CustomsOoc,
  sequelize,
} = require("../../models");
const { signToken } = require("../utils/jwt");

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
    const record = await CustomsRapiscan.create({
      containerNumber,
      containerSize,
      scanningStatus,
      scanningDateTime: new Date(scanningDateTime),
      createdBy: operatorId,
    });

    return {
      status: "SUCCESS",
      data: {
        id: record?.id,
        containerNumber: record?.containerNumber || containerNumber,
        containerSize: record?.containerSize || containerSize,
        scanningStatus: record?.scanningStatus || scanningStatus,
        scanningDateTime: payload.scanningDateTime,
      },
      message: "Rapiscan details received successfully.",
    };
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
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
    throw error;
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
    const examination = await CustomsExamination.create({
      containerNumber,
      igmNumber,
      dateOfExamination,
      examinationFindings,
      discrepancyFound,
      createdBy: operatorId,
    });

    return {
      status: "SUCCESS",
      data: {
        id: examination.id,
        containerNumber: examination.containerNumber,
        igmNumber: examination.igmNumber,
        dateOfExamination: examination.dateOfExamination,
        examinationFindings: examination.examinationFindings,
        discrepancyFound: examination.discrepancyFound,
        createdAt: examination.createdAt,
      },
      message: "Customs examination details saved successfully.",
    };
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return {
        status: "ALREADY_EXISTS",
        message: `Examination record already exists for container ${containerNumber}, IGM ${igmNumber}`,
      };
    }
    throw error;
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
    const oocRecord = await CustomsOoc.create({
      containerNumber,
      containerSize,
      oocStatus,
      oocNumber,
      dateTime: new Date(dateTime),
      receivedBy: operatorId,
    });

    return {
      status: "SUCCESS",
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
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return {
        status: "ALREADY_EXISTS",
        message: "Duplicate OOC transaction",
      };
    }
    throw error;
  }
}

module.exports = {
  loginOperator,
  pushRapiscanRecord,
  submitExaminationRecord,
  pushOocRecord,
};

