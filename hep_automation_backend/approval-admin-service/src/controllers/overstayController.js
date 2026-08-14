const Overstay = require("../models/overstaySchema");
const HepRate = require("../models/hepRateConfigSchema");
const { pool } = require("../dbconfig/db");
const sendEmailEvent = require("../utils/kafka/producer");

/* ─────────────────────────────────────────────
   OVERSTAY CHARGES CONTROLLER
   All endpoints go through verifyToken middleware
   so req.user is always populated.
───────────────────────────────────────────── */

/**
 * Resolve the display name for audit columns (levied_by, decided_by, etc.)
 * Looks up userName from the users table by userId from the JWT.
 * Falls back to the numeric userId so audit fields are never blank.
 */
const resolveActorName = async (reqUser) => {
  try {
    const userId = reqUser?.userId || reqUser?.id;
    if (!userId) return "ATM Officer";
    const result = await pool.query(
      `SELECT "userName" FROM "users" WHERE id = $1`,
      [userId]
    );
    return result.rows[0]?.userName || String(userId);
  } catch {
    return String(reqUser?.userId || reqUser?.id || "ATM Officer");
  }
};

exports.getPassBlockSetting = async (req, res) => {
  try {
    const setting = await Overstay.getPassBlockSetting();
    res.status(200).json({ success: true, data: setting });
  } catch (err) {
    console.error("getPassBlockSetting error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.setPassBlockSetting = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ success: false, message: "enabled must be a boolean" });
    }
    const updatedBy = await resolveActorName(req.user);
    const setting = await Overstay.setPassBlockSetting(enabled, updatedBy);
    res.status(200).json({
      success: true,
      message: `Overstay pass-blocking ${enabled ? "enabled" : "disabled"}`,
      data: setting,
    });
  } catch (err) {
    console.error("setPassBlockSetting error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAgentPassBlockSetting = async (req, res) => {
  try {
    const { agentId } = req.params;
    const setting = await Overstay.getAgentPassBlockSetting(agentId);
    res.status(200).json({ success: true, data: setting });
  } catch (err) {
    console.error("getAgentPassBlockSetting error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.setAgentPassBlockSetting = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ success: false, message: "enabled must be a boolean" });
    }
    const updatedBy = await resolveActorName(req.user);
    const setting = await Overstay.setAgentPassBlockSetting(agentId, enabled, updatedBy);
    res.status(200).json({
      success: true,
      message: `Pass blocked for this company: ${enabled ? "ON" : "OFF"}`,
      data: setting,
    });
  } catch (err) {
    console.error("setAgentPassBlockSetting error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getChargePassBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await Overstay.getChargePassBlock(id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("getChargePassBlock error:", err);
    res.status(err.message === "Charge not found" ? 404 : 500).json({ success: false, message: err.message || "Internal server error" });
  }
};

exports.setChargePassBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const { blocked } = req.body;
    if (typeof blocked !== "boolean") {
      return res.status(400).json({ success: false, message: "blocked must be a boolean" });
    }
    const data = await Overstay.setChargePassBlock(id, blocked);
    res.status(200).json({
      success: true,
      message: `Pass blocked for this company: ${blocked ? "ON" : "OFF"}`,
      data,
    });
  } catch (err) {
    console.error("setChargePassBlock error:", err);
    res.status(err.message === "Charge not found" ? 404 : 500).json({ success: false, message: err.message || "Internal server error" });
  }
};

exports.getAutoEmailSetting = async (req, res) => {
  try {
    const setting = await Overstay.getAutoEmailSetting();
    res.status(200).json({ success: true, data: setting });
  } catch (err) {
    console.error("getAutoEmailSetting error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.setAutoEmailSetting = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ success: false, message: "enabled must be a boolean" });
    }
    const updatedBy = await resolveActorName(req.user);
    const setting = await Overstay.setAutoEmailSetting(enabled, updatedBy);
    res.status(200).json({
      success: true,
      message: `Automatic overstay emails ${enabled ? "enabled" : "disabled"}`,
      data: setting,
    });
  } catch (err) {
    console.error("setAutoEmailSetting error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
/**
 * Resolve the daily rate for overstay penalty calculation.
 * Per SRS: "a penalty equal to respective daily charges will be levied
 * for overstay ... calculated for the period of overstay from the date
 * of expiry of HEP." The daily charge must come from hep_rate_config —
 * the single source of truth for the HEP rates maintained by ATM.
 */
const getDailyRate = async (category) => {
  const rates = await HepRate.getHepRates();
  const row = rates.find(
    (item) => String(item.category).toUpperCase() === String(category).toUpperCase()
  );

  if (!row) {
    throw new Error(`No HEP rate configuration found for category '${category}'`);
  }

  return parseFloat(row.daily_rate);
};

/**
 * Map entity_type (+ optional finer category from the client, e.g. for
 * cargo handling equipment vehicles) to a hep_rate_config category value.
 */
const resolveFeeCategory = (entity_type, category) => {
  if (category) return String(category).toUpperCase().trim();
  if (entity_type === "PERSON") return "INDIVIDUAL";
  if (entity_type === "DRIVER") return "INDIVIDUAL";
  if (entity_type === "VEHICLE") return "VEHICLE";
  throw new Error(`Cannot resolve fee category for entity_type '${entity_type}'`);
};

exports.detectOverstays = async (req, res) => {
  try {
    const records = await Overstay.detectOverstays();
    res.status(200).json({ success: true, count: records.length, data: records });
  } catch (err) {
    console.error("detectOverstays error:", err);
    res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};

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
 *
 * Per SRS: penalty = respective daily charge (from pass_fee_master)
 * × overstay_days (period of overstay from date of expiry of HEP).
 * daily_rate and total_amount are NOT accepted from the client anymore —
 * they are derived server-side so the backend cannot drift from the
 * fee master table, regardless of what the frontend sends.
 *
 * Body: { entity_type, entity_id, pass_request_id, agent_id,
 *          identifier, entity_name, pass_no, category,
 *          date_from, date_to, overstay_days, notes }
 */
exports.levyCharge = async (req, res) => {
  try {
    const {
      entity_type, entity_id, pass_request_id, agent_id,
      identifier, entity_name, pass_no, category, pass_type,
      date_from, date_to, overstay_days, notes,
    } = req.body;

    const parsedDays = parseInt(overstay_days, 10);
    if (!entity_type || !identifier || overstay_days === undefined || overstay_days === null || isNaN(parsedDays)) {
      return res.status(400).json({
        success: false,
        message: "entity_type, identifier, and valid overstay_days are required",
      });
    }

    const overstayDaysInt = parseInt(overstay_days, 10);
    if (!Number.isFinite(overstayDaysInt) || overstayDaysInt <= 0) {
      return res.status(400).json({
        success: false,
        message: "overstay_days must be a positive integer",
      });
    }

    const feeCategory = resolveFeeCategory(entity_type, category);
    const dailyRate = await getDailyRate(feeCategory);
    const totalAmount = parseFloat((dailyRate * overstayDaysInt).toFixed(2));

    const leviedBy = await resolveActorName(req.user);

    const charge = await Overstay.levyCharge({
      entity_type,
      entity_id,
      pass_request_id,
      agent_id,
      identifier,
      entity_name,
      pass_no,
      pass_type,
      date_from,
      date_to,
      overstay_days: overstayDaysInt,
      daily_rate: dailyRate,
      total_amount: totalAmount,
      levied_by: leviedBy,
      notes,
    });

    try {
      if (agent_id) {
        const agentEmail = await Overstay.getAgentEmail(agent_id);
        if (agentEmail) {
          await sendEmailEvent({
            type: "OVERSTAY_LEVIED",
            email: agentEmail,
            agent_id,
            identifier,
            entity_type,
            pass_no: charge.pass_no,
            date_to: charge.date_to,
            total_amount: charge.total_amount,
            overstay_days: charge.overstay_days,
            charge_id: charge.id,
          });
        } else {
          console.warn(`OVERSTAY_LEVIED: no email on record for agent_id ${agent_id}; skipping event`);
        }
      }
    } catch (_kafkaErr) {
      console.warn("Kafka OVERSTAY_LEVIED event failed (non-critical):", _kafkaErr.message);
    }

    res.status(201).json({ success: true, message: "Overstay charge levied successfully", data: charge });
  } catch (err) {
    console.error("levyCharge error:", err);
    const status = /fee configuration|fee category/i.test(err.message) ? 422 : 500;
    res.status(status).json({ success: false, message: err.message || "Internal server error" });
  }
};

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

exports.listExceptionRequests = async (req, res) => {
  try {
    const records = await Overstay.listExceptionRequests();
    res.status(200).json({ success: true, count: records.length, data: records });
  } catch (err) {
    console.error("listExceptionRequests error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.approveException = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const decidedBy = await resolveActorName(req.user);
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

exports.rejectException = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const decidedBy = await resolveActorName(req.user);
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

exports.notifyCharge = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const charge = await Overstay.getById(id);

    if (!charge) {
      return res.status(404).json({ success: false, message: "Charge not found" });
    }

    if (!charge.agent_email) {
      return res.status(422).json({
        success: false,
        message: "No email address on record for the agent associated with this charge",
      });
    }

    // Use the live/current figures for statuses that are still accruing,
    // same rule as the table UI and the stats cards.
    const isLive = ["PENDING", "EXCEPTION_REQUESTED", "EXCEPTION_REJECTED"].includes(charge.status);
    const liveOverstayDays = isLive ? charge.current_overstay_days : charge.overstay_days;
    const liveTotalAmount = isLive ? charge.current_total_amount : charge.total_amount;

    await sendEmailEvent({
      type: "OVERSTAY_REMINDER",
      email: charge.agent_email,
      company_name: charge.company_name || null,
      login_id: charge.login_id || null,
      identifier: charge.identifier,
      entity_type: charge.entity_type,
      pass_no: charge.pass_no || null,
      date_to: charge.date_to,
      overstay_days: liveOverstayDays,
      daily_rate: charge.daily_rate,
      total_amount: liveTotalAmount,
      charge_id: charge.id,
    });

    await Overstay.markEmailSent(id);

    res.status(200).json({
      success: true,
      message: `Overstay reminder email queued for ${charge.agent_email}`,
    });
  } catch (err) {
    console.error("notifyCharge error:", err);
    res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};

/**
 * POST /overstay/notify-detected
 * Send an overstay expiry reminder for a detected (un-levied) entity.
 * Creates/keeps a NOTIFIED row so the company can see reminder status,
 * but no levy amount is exposed until ATM explicitly clicks Levy.
 *
 * Body: { agent_id, company_name, login_id, identifier, entity_type,
 *         pass_no, date_to, overstay_days }
 */
exports.notifyDetected = async (req, res) => {
  try {
    const {
      entity_type, entity_id, pass_request_id, agent_id,
      company_name, login_id, identifier, entity_name, pass_no, category, pass_type,
      date_from, date_to, overstay_days,
    } = req.body;

    if (!agent_id || !identifier || !entity_type) {
      return res.status(400).json({
        success: false,
        message: "agent_id, identifier, and entity_type are required",
      });
    }

    const agentEmail = await Overstay.getAgentEmail(agent_id);
    if (!agentEmail) {
      return res.status(422).json({
        success: false,
        message: "No email address on record for this agent",
      });
    }

    const overstayDaysInt = parseInt(overstay_days, 10) || 0;

    const notifiedBy = await resolveActorName(req.user);

    // Create the charge now so it's visible under the company's login
    // (e.g. via myCharges) immediately, not only once someone clicks Levy.
    const charge = await Overstay.createNotification({
      entity_type,
      entity_id,
      pass_request_id,
      agent_id,
      identifier,
      entity_name,
      pass_no,
      pass_type,
      date_from,
      date_to,
      overstay_days: overstayDaysInt,
      levied_by: notifiedBy,
      notes: "Overstay reminder sent; penalty not levied yet",
    });

    try {
      await sendEmailEvent({
        type: "OVERSTAY_REMINDER",
        email: agentEmail,
        company_name: company_name || null,
        login_id: login_id || null,
        identifier,
        entity_type,
        pass_no: pass_no || null,
        date_to,
        overstay_days: overstayDaysInt,
        charge_id: charge.id,
      });
      await Overstay.markEmailSent(charge.id);
    } catch (_kafkaErr) {
      console.warn("Kafka OVERSTAY_REMINDER event failed (non-critical):", _kafkaErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Overstay expiry reminder queued for ${agentEmail}; company can now see reminder status`,
      data: charge,
    });
  } catch (err) {
    console.error("notifyDetected error:", err);
    res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};

exports.waiveDetected = async (req, res) => {
  try {
    const {
      entity_type, entity_id, pass_request_id, agent_id,
      identifier, entity_name, pass_no, category,
      date_from, date_to, overstay_days,
    } = req.body;

    if (!entity_type || !identifier) {
      return res.status(400).json({
        success: false,
        message: "entity_type and identifier are required",
      });
    }

    const waivedBy = await resolveActorName(req.user);

    // Insert directly as WAIVED so detectOverstays excludes this entity going forward
    const result = await pool.query(
      `INSERT INTO overstay_charges (
          entity_type, entity_id, pass_request_id, agent_id,
          identifier, entity_name, pass_no, date_from, date_to,
          overstay_days, daily_rate, total_amount, status,
          levied_by, levied_at, exception_decided_by, exception_decided_at, notes
       ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, 0, 0, 'WAIVED',
          $11, NOW(), $11, NOW(),
          'Waived at detection — entity likely exited port without recorded Gate OUT'
       ) RETURNING *`,
      [
        entity_type,
        entity_id || null,
        pass_request_id || null,
        agent_id || null,
        identifier,
        entity_name || null,
        pass_no || null,
        date_from || null,
        date_to || null,
        parseInt(overstay_days, 10) || 0,
        waivedBy,
      ]
    );

    res.status(201).json({
      success: true,
      message: `${identifier} marked as waived — will no longer appear in detected overstays`,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("waiveDetected error:", err);
    res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};

exports.waiveCharge = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const waivedBy = await resolveActorName(req.user);
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