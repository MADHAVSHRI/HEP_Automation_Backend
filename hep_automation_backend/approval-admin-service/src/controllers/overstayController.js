const Overstay = require("../models/overstaySchema");
const sendEmailEvent = require("../utils/kafka/producer");

/* ─────────────────────────────────────────────
   OVERSTAY CHARGES CONTROLLER
   All endpoints go through verifyToken middleware
   so req.user is always populated.
───────────────────────────────────────────── */

/**
 * GET /overstay/detect
 * ATM: returns pass entities currently overstaying
 * (dateTo < today) that do NOT have an active levied charge.
 */
exports.detectOverstays = async (req, res) => {
  try {
    const records = await Overstay.detectOverstays();
    res.status(200).json({ success: true, count: records.length, data: records });
  } catch (err) {
    console.error("detectOverstays error:", err);
    res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};

/**
 * GET /overstay/charges
 * ATM / Traffic: list all levied charges with optional filters:
 *   ?status=PENDING &entity_type=PERSON &agent_id=123
 */
exports.listCharges = async (req, res) => {
  try {
    const { status, entity_type, agent_id, limit, offset } = req.query;
    const charges = await Overstay.listCharges({
      status: status || null,
      entity_type: entity_type || null,
      agent_id: agent_id ? parseInt(agent_id, 10) : null,
      limit: Math.min(parseInt(limit || "200", 10), 500),
      offset: parseInt(offset || "0", 10),
    });
    res.status(200).json({ success: true, count: charges.length, data: charges });
  } catch (err) {
    console.error("listCharges error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /overstay/levy
 * ATM: levy an overstay charge on a detected entity.
 * Body: { entity_type, entity_id, pass_request_id, agent_id,
 *          identifier, entity_name, pass_no,
 *          date_from, date_to, overstay_days, daily_rate, total_amount, notes }
 */
exports.levyCharge = async (req, res) => {
  try {
    const {
      entity_type, entity_id, pass_request_id, agent_id,
      identifier, entity_name, pass_no,
      date_from, date_to, overstay_days, daily_rate, total_amount, notes,
    } = req.body;

    if (!entity_type || !identifier || !overstay_days) {
      return res.status(400).json({
        success: false,
        message: "entity_type, identifier, and overstay_days are required",
      });
    }

    const leviedBy = req.user?.userName || req.user?.userId || "ATM Officer";

    const charge = await Overstay.levyCharge({
      entity_type,
      entity_id,
      pass_request_id,
      agent_id,
      identifier,
      entity_name,
      pass_no,
      date_from,
      date_to,
      overstay_days: parseInt(overstay_days, 10),
      daily_rate: parseFloat(daily_rate || (entity_type === 'VEHICLE' ? (process.env.OVERSTAY_DAILY_RATE_VEHICLE || "200") : (process.env.OVERSTAY_DAILY_RATE_PERSON || "100"))),
      total_amount: parseFloat(total_amount || 0),
      levied_by: leviedBy,
      notes,
    });

    // Fire Kafka notification to agent if possible
    try {
      if (agent_id) {
        await sendEmailEvent({
          type: "OVERSTAY_LEVIED",
          agent_id,
          identifier,
          entity_type,
          total_amount: charge.total_amount,
          overstay_days: charge.overstay_days,
          charge_id: charge.id,
        });
      }
    } catch (_kafkaErr) {
      console.warn("Kafka OVERSTAY_LEVIED event failed (non-critical):", _kafkaErr.message);
    }

    res.status(201).json({ success: true, message: "Overstay charge levied successfully", data: charge });
  } catch (err) {
    console.error("levyCharge error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /overstay/my-charges
 * Agent: view own overstay charges.
 * Requires agent token — userId is used as agentId
 * (per system convention: req.user.userId is the Agents.id for source=agent).
 */
exports.myCharges = async (req, res) => {
  try {
    const agentId = req.user?.userId || req.user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const charges = await Overstay.myCharges(agentId);
    res.status(200).json({ success: true, count: charges.length, data: charges });
  } catch (err) {
    console.error("myCharges error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * PATCH /overstay/:id/pay
 * Agent: pay an overstay charge.
 * Body: { payment_method, transaction_id }
 */
exports.payCharge = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await Overstay.getById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Charge not found" });
    }

    const txnId = req.body.transaction_id || `TXN-OVS-${Date.now()}`;
    const updated = await Overstay.pay(id, {
      payment_method: req.body.payment_method || "GATEWAY",
      transaction_id: txnId,
    });

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: "Cannot pay this charge in its current state (PENDING or EXCEPTION_REJECTED required)",
      });
    }

    res.status(200).json({ success: true, message: "Overstay charge paid successfully", data: updated });
  } catch (err) {
    console.error("payCharge error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * PATCH /overstay/:id/request-exception
 * Agent: request exception for a PENDING overstay charge.
 * Body: { exception_reason }
 */
exports.requestException = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { exception_reason } = req.body;
    if (!exception_reason || exception_reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "exception_reason must be at least 10 characters",
      });
    }
    const updated = await Overstay.requestException(id, exception_reason.trim());
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: "Charge not found or not in PENDING status",
      });
    }
    res.status(200).json({ success: true, message: "Exception request submitted", data: updated });
  } catch (err) {
    console.error("requestException error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /overstay/exception-requests
 * Traffic: list all charges with status EXCEPTION_REQUESTED
 */
exports.listExceptionRequests = async (req, res) => {
  try {
    const records = await Overstay.listExceptionRequests();
    res.status(200).json({ success: true, count: records.length, data: records });
  } catch (err) {
    console.error("listExceptionRequests error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * PATCH /overstay/:id/approve-exception
 * Traffic: approve an exception request.
 */
exports.approveException = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const decidedBy = req.user?.userName || req.user?.userId || "Traffic Officer";
    const updated = await Overstay.approveException(id, decidedBy);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: "Charge not found or not in EXCEPTION_REQUESTED status",
      });
    }
    res.status(200).json({ success: true, message: "Exception approved", data: updated });
  } catch (err) {
    console.error("approveException error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * PATCH /overstay/:id/reject-exception
 * Traffic: reject an exception request.
 */
exports.rejectException = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const decidedBy = req.user?.userName || req.user?.userId || "Traffic Officer";
    const updated = await Overstay.rejectException(id, decidedBy);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: "Charge not found or not in EXCEPTION_REQUESTED status",
      });
    }
    res.status(200).json({ success: true, message: "Exception rejected", data: updated });
  } catch (err) {
    console.error("rejectException error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * PATCH /overstay/:id/waive
 * ATM: manually waive any non-paid/non-waived charge.
 */
exports.waiveCharge = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const waivedBy = req.user?.userName || req.user?.userId || "ATM Officer";
    const updated = await Overstay.waive(id, waivedBy);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: "Charge not found or already paid/waived",
      });
    }
    res.status(200).json({ success: true, message: "Charge waived successfully", data: updated });
  } catch (err) {
    console.error("waiveCharge error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
