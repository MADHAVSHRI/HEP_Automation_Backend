const { successLogger, errorLogger } = require("../logger/logger");
const { buildTruckGatePayload } = require("../services/truckGatePayload");
const {
  pushTruckGateIn,
  pushTruckGateOut,
} = require("../services/truckGateClient");

const TAG = "TRUCK_GATE";

/*
 * Shared handler. Gate-in and gate-out differ only in direction, the endpoint
 * and the API key — all of which the client resolves — so one body serves both.
 */
const handle = async (req, res, direction, push) => {
  const label = direction === "IN" ? "Truck Gate-In" : "Truck Gate-Out";

  try {
    const { payload, missing } = buildTruckGatePayload(req.body, direction);

    if (missing.length > 0) {
      errorLogger.error(`${TAG} | ${label} rejected | missing=${missing.join(",")}`);
      return res.status(400).json({
        success: false,
        pushed: false,
        message: `Missing required field(s): ${missing.join(", ")}`,
      });
    }

    const result = await push(payload);

    // 200 either way: the gate movement already happened, so a push failure is
    // reported, not raised — the caller cannot undo it.
    return res.json({
      success: result.success,
      pushed: result.success,
      status: result.status,
      message: result.message,
    });
  } catch (error) {
    errorLogger.error(`${TAG} | ${label} errored | ${error.message}`);
    return res.json({ success: false, pushed: false, message: error.message });
  }
};

/**
 * POST /api/iportman/truck-gate-in
 * Body: { VehicleRegdNo, VehiclePassReferenceNo, VehiclePassValidTo,
 *         TruckStatus, IsContainer, GateNo, GateInDT?, Portcode? }
 */
const truckGateIn = (req, res) => handle(req, res, "IN", pushTruckGateIn);

/**
 * POST /api/iportman/truck-gate-out
 * Same body, with GateOutDT in place of GateInDT.
 */
const truckGateOut = (req, res) => handle(req, res, "OUT", pushTruckGateOut);

/**
 * POST /api/iportman/truck-gate-:direction/preview
 *
 * Returns the document that would be sent, without sending it. The field
 * mapping is the part most likely to need checking against iPortman.
 */
const previewTruckGate = (req, res) => {
  const direction = req.params.direction === "out" ? "OUT" : "IN";
  const { payload, missing } = buildTruckGatePayload(req.body, direction);

  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing required field(s): ${missing.join(", ")}`,
    });
  }

  successLogger.info(`${TAG} | preview ${direction}`);
  return res.json({ success: true, data: payload });
};

module.exports = { truckGateIn, truckGateOut, previewTruckGate };
