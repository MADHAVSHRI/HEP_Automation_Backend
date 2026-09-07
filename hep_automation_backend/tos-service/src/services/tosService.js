const bcrypt = require("bcrypt");
const { TosOperator, TosForm13, TosForm13Container, TosEirRecord, sequelize } = require("../../models");
const { signToken } = require("../utils/jwt");
const { eirQueue, eirQueueEvents } = require("../queues/eirQueue");
const { form13Queue, form13QueueEvents } = require("../queues/form13Queue");
const { normalizeEirItem, validateForm13Payload, validateEirItem } = require("../validators/tosValidator");

function getIstFormattedTimestamp(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(date.getTime()) ? new Date() : date;

  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(validDate);

  const p = {};
  parts.forEach(({ type, value }) => {
    p[type] = value;
  });

  return `${p.year}${p.month}${p.day}_${p.hour}${p.minute}${p.second}`;
}

async function loginOperator({ loginId, password }) {
  if (!loginId || !password) {
    const error = new Error("loginId and password are required");
    error.statusCode = 400;
    throw error;
  }

  const operator = await TosOperator.scope("withPassword").findOne({ where: { loginId } });

  if (!operator || !(await bcrypt.compare(password, operator.password))) {
    const error = new Error("Invalid login id or password");
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
    terminal: operator.terminal,
  });

  return {
    token,
    data: {
      loginId: operator.loginId,
      terminal: operator.terminal,
    },
  };
}

async function pushForm13Record({ payload, operatorId }) {
  const validationErrors = validateForm13Payload(payload);

  if (validationErrors.length) {
    const error = new Error(validationErrors.join("; "));
    error.statusCode = 400;
    throw error;
  }

  let { form13No, terminal, trailerNumber, containers } = payload;

  if (!form13No || typeof form13No !== "string" || !form13No.trim()) {
    const termPrefix = (terminal || "TOS").trim().toUpperCase();
    const trNum = (trailerNumber || "NOTRAILER").trim().toUpperCase();
    const istTime = getIstFormattedTimestamp();
    form13No = `${termPrefix}_${trNum}_${istTime}`;
  } else {
    form13No = form13No.trim();
  }

  const existing = await TosForm13.findOne({ where: { form13No } });
  if (existing) {
    return { status: "ALREADY_EXISTS", form13No, message: `Form-13 record '${form13No}' already exists and was previously processed` };
  }

  try {
    const job = await form13Queue.add("pushForm13Job", {
      form13No,
      terminal,
      trailerNumber,
      containers,
      createdBy: operatorId,
    });

    const result = await job.waitUntilFinished(form13QueueEvents, 5000);

    if (result?.skipped) {
      return { status: "ALREADY_EXISTS", form13No, message: `Form-13 record '${form13No}' already exists` };
    }

    return { status: "SUCCESS", form13No, message: "Form-13 record saved successfully" };
  } catch (queueErr) {
    const transaction = await sequelize.transaction();

    try {
      const form13 = await TosForm13.create(
        {
          form13No,
          terminal,
          trailerNumber,
          createdBy: operatorId,
        },
        { transaction },
      );

      const rows = containers.map((item) => ({
        form13Id: form13.id,
        containerNumber: item.containerNumber || null,
        containerSize: item.containerSize || null,
        containerISO: item.containerISO || null,
        containerType: item.containerType && !item.containerType.includes("/") ? item.containerType : null,
        movementType: item.movementType,
      }));

      await TosForm13Container.bulkCreate(rows, { transaction });
      await transaction.commit();

      return { status: "PROCESSED_DIRECTLY", form13No, message: "Form-13 record saved successfully" };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

async function processSingleEirItem(raw, index, operatorId, totalCount) {
  const item = normalizeEirItem(raw);

  if (!item) {
    return { index, success: false, message: "Invalid payload item format" };
  }

  const validation = validateEirItem(item);
  if (!validation.valid) {
    return { index, success: false, message: validation.errors.join("; ") };
  }

  if (!item.eirNo || typeof item.eirNo !== "string" || !item.eirNo.trim()) {
    const termPrefix = (item.terminal || "TOS").trim().toUpperCase();
    const istTime = getIstFormattedTimestamp(item.inGateDateTime);
    const contNum = (item.containerNumber || "NOCON").trim().toUpperCase();
    const trNum = (item.trailerNumber || "NOTRAILER").trim().toUpperCase();
    const indexSuffix = totalCount > 1 ? `_${index}` : "";
    item.eirNo = `${termPrefix}_${contNum}_${trNum}_${istTime}${indexSuffix}`;
  } else {
    item.eirNo = item.eirNo.trim();
  }

  const existing = await TosEirRecord.findOne({ where: { eirNo: item.eirNo } });
  if (existing) {
    return {
      index,
      success: true,
      status: "ALREADY_EXISTS",
      message: `EIR record with key '${item.eirNo}' already exists and was previously processed`,
      eirNo: item.eirNo,
    };
  }

  try {
    const job = await eirQueue.add("pushEirJob", { ...item, createdBy: operatorId });
    const result = await job.waitUntilFinished(eirQueueEvents, 5000);

    if (result?.skipped) {
      return {
        index,
        success: true,
        status: "ALREADY_EXISTS",
        message: `EIR record with key '${item.eirNo}' already exists`,
        eirNo: item.eirNo,
      };
    }

    return {
      index,
      success: true,
      status: "SUCCESS",
      message: "EIR record saved successfully",
      eirNo: item.eirNo,
    };
  } catch (queueErr) {
    try {
      await TosEirRecord.create({ ...item, createdBy: operatorId });
      return {
        index,
        success: true,
        status: "PROCESSED_DIRECTLY",
        message: "EIR record saved successfully",
        eirNo: item.eirNo,
      };
    } catch (dbErr) {
      if (dbErr.name === "SequelizeUniqueConstraintError") {
        return {
          index,
          success: true,
          status: "ALREADY_EXISTS",
          message: `EIR record with key '${item.eirNo}' already exists`,
          eirNo: item.eirNo,
        };
      }
      return {
        index,
        success: false,
        message: dbErr.message || "Failed to save EIR record",
        eirNo: item.eirNo,
      };
    }
  }
}

async function pushEirRecord({ payload, operatorId }) {
  let rawItems = [];

  if (Array.isArray(payload?.GateMovement_Details)) {
    rawItems = payload.GateMovement_Details;
  } else if (Array.isArray(payload)) {
    rawItems = payload;
  } else if (payload && typeof payload === "object") {
    rawItems = [payload];
  }

  if (!rawItems.length) {
    const error = new Error("No EIR data provided in request body");
    error.statusCode = 400;
    throw error;
  }

  const results = await Promise.all(
    rawItems.map((raw, index) => processSingleEirItem(raw, index, operatorId, rawItems.length)),
  );

  return { results, totalProcessed: results.length };
}

module.exports = {
  loginOperator,
  pushForm13Record,
  pushEirRecord,
};
