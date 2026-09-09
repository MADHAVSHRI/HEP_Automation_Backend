/**
 * gateVerificationController.js — gate-service
 */

const gateVerificationService = require("../services/gateVerificationService");
const gateAccessService = require("../services/gateAccessService");
const { GateEventError } = gateVerificationService;
const { errorLogger } = require("../logger/logger");

/**
 * POST /api/gate-verification/event
 *
 * Production entry point for gate hardware (QR reader, face terminal, ANPR,
 * container OCR). Authenticated with the shared service key.
 */
exports.receiveHardwareEvent = async (req, res) => {
  try {
    const { payload, recipients } = await gateVerificationService.processEvent(
      req.body,
      "HARDWARE",
    );

    return res.status(202).json({
      success: true,
      message: "Event accepted",
      data: {
        eventId: payload.eventId,
        status: payload.status,
        delivered: recipients,
      },
    });
  } catch (error) {
    if (error instanceof GateEventError) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }

    errorLogger.error({
      context: "HARDWARE_EVENT",
      message: error.message,
      stack: error.stack,
    });
    return res
      .status(500)
      .json({ success: false, message: "Failed to process gate event" });
  }
};

/**
 * POST /api/gate-verification/test-event
 *
 * Simulation entry point used while the hardware is unavailable. It runs the
 * identical pipeline — only the recorded `source` differs — and it is limited
 * to gates the calling officer is actually posted to, so it cannot be used to
 * push events into another officer's gate.
 */
exports.simulateEvent = async (req, res) => {
  try {
    const gateId = req.body.gateId || req.body.gateCode;
    if (!gateId) {
      return res
        .status(400)
        .json({ success: false, message: "gateId is required" });
    }

    const allowed = await gateAccessService.canAccessGate(
      req.user.userId,
      gateId,
    );
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this gate",
      });
    }

    const { payload, recipients } = await gateVerificationService.processEvent(
      req.body,
      "SIMULATION",
    );

    return res.status(202).json({
      success: true,
      message: "Simulated event accepted",
      data: {
        eventId: payload.eventId,
        status: payload.status,
        delivered: recipients,
        payload,
      },
    });
  } catch (error) {
    if (error instanceof GateEventError) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }

    errorLogger.error({
      context: "SIMULATED_EVENT",
      message: error.message,
      stack: error.stack,
    });
    return res
      .status(500)
      .json({ success: false, message: "Failed to process gate event" });
  }
};

/**
 * GET /api/gate-verification/my-gates
 *
 * The gates the signed-in officer is posted to. The console calls this to
 * label the gate bar; the socket layer resolves the same list independently.
 */
exports.getMyGates = async (req, res) => {
  try {
    const gates = await gateAccessService.getAssignedGates(req.user.userId);

    return res.json({
      success: true,
      message: "Assigned gates fetched",
      data: gates,
    });
  } catch (error) {
    errorLogger.error({
      context: "MY_GATES",
      message: error.message,
    });
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch assigned gates" });
  }
};

/**
 * GET /api/gate-verification/gates/:gateCode/events
 *
 * Recent events for one gate, so a console that opens (or reconnects) can
 * show the last known state instead of an empty screen.
 */
exports.getGateEvents = async (req, res) => {
  try {
    const { gateCode } = req.params;

    const allowed = await gateAccessService.canAccessGate(
      req.user.userId,
      gateCode,
    );
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this gate",
      });
    }

    const gate = await gateAccessService.findGateByCode(gateCode);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const events = await gateVerificationService.getRecentEvents(
      gate.id,
      limit,
    );

    return res.json({
      success: true,
      message: "Gate events fetched",
      data: events,
    });
  } catch (error) {
    errorLogger.error({
      context: "GATE_EVENTS",
      message: error.message,
    });
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch gate events" });
  }
};
