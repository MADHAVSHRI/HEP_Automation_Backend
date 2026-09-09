/**
 * gateVerificationService.js — gate-service
 *
 * The one processing pipeline for gate events. The production hardware route
 * and the simulation route both call `processEvent`, so a simulated event
 * exercises exactly the same normalisation, lookup, persistence and delivery
 * path as a real device.
 *
 *   device payload
 *        ↓  validate + resolve gate
 *        ↓  resolve identifier via the type registry
 *        ↓  normalise
 *        ↓  persist (audit)
 *        ↓  emit to the gate room
 */

const { randomUUID } = require("crypto");
const { GateVerificationEvent } = require("../../models");
const {
  VERIFICATION_STATUS,
  VERIFICATION_TYPES,
} = require("../constants/constants");
const gateAccessService = require("./gateAccessService");
const verificationTypes = require("./verificationTypes");
const realtime = require("../realtime/emitter");
const { successLogger, errorLogger } = require("../logger/logger");

/** Raised for input the caller can fix; carries the HTTP status to answer. */
class GateEventError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Accepts the loose shapes a device may send and settles on one meaning.
 * Hardware vendors differ, so aliases are tolerated here rather than forcing
 * every integration to match one spelling.
 */
const readIncoming = (body) => ({
  gateId: body.gateId || body.gateCode || body.gate,
  verificationType: (body.verificationType || body.type || "")
    .toString()
    .toUpperCase(),
  identifier:
    body.identifier ||
    body.value ||
    body.plateNumber ||
    body.containerNumber ||
    body.cardNumber ||
    body.employeeId,
  verified:
    typeof body.verified === "boolean"
      ? body.verified
      : typeof body.success === "boolean"
        ? body.success
        : undefined,
  matchScore: body.matchScore ?? body.confidence ?? body.score ?? null,
  deviceId: body.deviceId || body.device || null,
  occurredAt: body.eventTimestamp || body.timestamp || body.occurredAt || null,
  reason: body.reason || null,
});

const parseTimestamp = (value) => {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const clampScore = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  // Devices report either 0-1 or 0-100; normalise to percent.
  const percent = num > 0 && num <= 1 ? num * 100 : num;
  return Math.max(0, Math.min(100, Math.round(percent)));
};

/**
 * Processes one gate event end to end and returns the normalised payload that
 * was delivered to the officers on that gate.
 *
 * @param {object} body   raw device (or simulator) payload
 * @param {string} source HARDWARE | SIMULATION — recorded for audit only
 */
const processEvent = async (body, source = "HARDWARE") => {
  const incoming = readIncoming(body);

  /* ── 1. Validate ───────────────────────────────────────────────────── */
  if (!incoming.gateId) {
    throw new GateEventError(400, "gateId is required");
  }
  if (!incoming.verificationType) {
    throw new GateEventError(400, "verificationType is required");
  }
  if (!verificationTypes.isSupported(incoming.verificationType)) {
    throw new GateEventError(
      400,
      `Unsupported verificationType: ${incoming.verificationType}`,
    );
  }
  if (!incoming.identifier) {
    throw new GateEventError(400, "identifier is required");
  }

  /* ── 2. Resolve the gate ───────────────────────────────────────────── */
  const gate = await gateAccessService.findGateByCode(incoming.gateId);
  if (!gate) {
    throw new GateEventError(404, `Unknown or inactive gate: ${incoming.gateId}`);
  }

  /* ── 3. Resolve the identifier into displayable detail ─────────────── */
  const handler = verificationTypes.getHandler(incoming.verificationType);
  let subject = null;
  let lookupFailed = false;

  try {
    subject = await handler.resolve(incoming.identifier);
  } catch (error) {
    // A lookup outage must not swallow the event: the officer still needs to
    // know a vehicle is standing at the barrier.
    errorLogger.error({
      context: "GATE_EVENT_LOOKUP",
      verificationType: incoming.verificationType,
      identifier: incoming.identifier,
      message: error.message,
    });
    lookupFailed = true;
  }

  /* ── 4. Decide the outcome ─────────────────────────────────────────── */
  // The device reports what it saw; the backend decides what it means. An
  // unknown identifier can never be a pass, whatever the device claims.
  let status;
  let reason = incoming.reason;

  if (incoming.verified === false) {
    status = VERIFICATION_STATUS.FAILED;
    reason = reason || `${incoming.verificationType} VERIFICATION FAILED`;
  } else if (lookupFailed) {
    status = VERIFICATION_STATUS.PENDING;
    reason = reason || "DETAIL LOOKUP UNAVAILABLE — MANUAL CHECK REQUIRED";
  } else if (!subject) {
    status = VERIFICATION_STATUS.FAILED;
    reason = reason || handler.notFoundReason;
  } else if (incoming.verified === true) {
    status = VERIFICATION_STATUS.PASSED;
  } else {
    status = VERIFICATION_STATUS.PENDING;
  }

  /* ── 5. Normalise ──────────────────────────────────────────────────── */
  const occurredAt = parseTimestamp(incoming.occurredAt);
  const payload = {
    eventId: randomUUID(),
    gate: {
      gateCode: gate.gateCode,
      gateName: gate.gateName,
      laneName: gate.laneName,
    },
    verificationType: incoming.verificationType,
    identifier: String(incoming.identifier),
    status,
    verified: status === VERIFICATION_STATUS.PASSED,
    matchScore: clampScore(incoming.matchScore),
    reason: reason || null,
    deviceId: incoming.deviceId,
    subject,
    occurredAt: occurredAt.toISOString(),
    receivedAt: new Date().toISOString(),
    source,
  };

  /* ── 6. Persist for audit / replay ─────────────────────────────────── */
  try {
    await GateVerificationEvent.create({
      eventId: payload.eventId,
      gateId: gate.id,
      verificationType: payload.verificationType,
      identifier: payload.identifier,
      status: payload.status,
      matchScore: payload.matchScore,
      reason: payload.reason,
      deviceId: payload.deviceId,
      payload,
      rawPayload: body,
      source,
      occurredAt,
    });
  } catch (error) {
    // Delivery matters more than the audit row; log and keep going.
    errorLogger.error({
      context: "GATE_EVENT_PERSIST",
      eventId: payload.eventId,
      message: error.message,
    });
  }

  /* ── 7. Deliver to the officers posted to this gate ────────────────── */
  const delivered = realtime.emitToGate(gate.gateCode, payload);

  successLogger.info({
    context: "GATE_EVENT",
    eventId: payload.eventId,
    gateCode: gate.gateCode,
    verificationType: payload.verificationType,
    status: payload.status,
    source,
    recipients: delivered,
  });

  return { payload, recipients: delivered };
};

/** Most recent events for a gate — used to bootstrap the console on open. */
const getRecentEvents = async (gateId, limit = 20) => {
  const events = await GateVerificationEvent.findAll({
    where: { gateId },
    order: [["occurredAt", "DESC"]],
    limit,
  });

  return events.map((event) => event.payload);
};

module.exports = {
  processEvent,
  getRecentEvents,
  GateEventError,
  VERIFICATION_TYPES,
};
