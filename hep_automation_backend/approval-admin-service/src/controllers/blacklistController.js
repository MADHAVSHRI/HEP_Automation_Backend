const Blacklist = require("../models/blacklistSchema");
const { pool } = require("../dbconfig/db");

/* ─────────────────────────────────────────────
   BLACKLIST CONTROLLER
   All endpoints use verifyToken middleware to
   populate req.user with the JWT payload.
───────────────────────────────────────────── */

/**
 * POST /blacklist/create
 * Body: { entity_type, identifier, entity_name, reason, scenario, has_penalty, penalty_amount }
 */
exports.createBlacklistEntry = async (req, res) => {
  try {
    const { entity_type, identifier, reason, reason_code } = req.body;

    if (!entity_type || !identifier || !reason) {
      return res.status(400).json({
        success: false,
        message: "entity_type, identifier, and reason are required",
      });
    }

    const validTypes = ["VEHICLE", "PERSON", "DRIVER", "COMPANY"];
    if (!validTypes.includes(entity_type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `entity_type must be one of: ${validTypes.join(", ")}`,
      });
    }

    // Check if entity is already blacklisted
    const existing = await Blacklist.checkBlacklisted(
      entity_type.toUpperCase(),
      identifier
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This entity is already blacklisted",
        data: existing[0],
      });
    }

    const documentPath = req.file ? `uploads/blacklist/${req.file.filename}` : null;

    const entry = await Blacklist.createEntry({
      ...req.body,
      entity_type: entity_type.toUpperCase(),
      blacklisted_by: req.user.userId,
      supporting_document_path: documentPath
    });

    // Lookup registered email to send email notification
    let targetEmail = null;
    let targetName = entry.entity_name || entry.identifier;

    try {
      if (entry.entity_type === 'COMPANY') {
        const userRes = await pool.query('SELECT email, "userName" FROM users WHERE "userName" = $1 OR id::text = $1', [identifier]);
        if (userRes.rows.length > 0) {
          targetEmail = userRes.rows[0].email;
          targetName = userRes.rows[0].userName;
        }
      } else if (entry.entity_type === 'PERSON' || entry.entity_type === 'DRIVER') {
        const passPersonRes = await pool.query('SELECT email, name FROM pass_persons WHERE "aadharNo" = $1 OR "idProofNumber" = $1 LIMIT 1', [identifier]);
        if (passPersonRes.rows.length > 0) {
          targetEmail = passPersonRes.rows[0].email;
          targetName = passPersonRes.rows[0].name;
        }
      }
    } catch (dbErr) {
      console.error("Failed to lookup entity email for blacklist:", dbErr);
    }

    if (targetEmail) {
      console.log(`\n==================================================`);
      console.log(`[EMAIL NOTIFICATION] Sending Blacklist alert to: ${targetEmail}`);
      console.log(`Subject: ⚠️ Chennai Port Blacklist Notification`);
      console.log(`Dear ${targetName},\n\nYou (or your vehicle/driver) has been blacklisted at Chennai Port.`);
      console.log(`Reason: ${reason} (Code: ${reason_code || '007'})`);
      console.log(`Authorizing Officer: ${entry.authorizing_officer || 'Traffic Department'}`);
      if (entry.has_penalty) {
        console.log(`Penalty Applicable: ₹${entry.penalty_amount}`);
      }
      console.log(`==================================================\n`);

      try {
        const sendEmailEvent = require("../utils/kafka/producer");
        await sendEmailEvent({
          type: "BLACKLISTED",
          email: targetEmail,
          name: targetName,
          identifier: entry.identifier,
          reason: reason,
          reason_code: reason_code || "007",
          penalty_amount: entry.has_penalty ? entry.penalty_amount : null
        });
      } catch (kErr) {
        console.warn("Kafka produce blacklist email warning:", kErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Entity blacklisted successfully",
      data: entry,
    });
  } catch (error) {
    console.error("createBlacklistEntry error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create blacklist entry",
    });
  }
};

/**
 * GET /blacklist/list?status=BLACKLISTED&entity_type=VEHICLE&search=TN01&page=1&limit=20
 */
exports.getBlacklistEntries = async (req, res) => {
  try {
    const { status, entity_type, search, page, limit } = req.query;

    const result = await Blacklist.getEntries({
      status,
      entity_type: entity_type ? entity_type.toUpperCase() : undefined,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("getBlacklistEntries error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blacklist entries",
    });
  }
};

/**
 * GET /blacklist/stats
 */
exports.getBlacklistStats = async (req, res) => {
  try {
    const stats = await Blacklist.getStats();
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error("getBlacklistStats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
    });
  }
};

/**
 * GET /blacklist/:id
 */
exports.getBlacklistById = async (req, res) => {
  try {
    const entry = await Blacklist.getById(req.params.id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Blacklist entry not found",
      });
    }

    return res.json({ success: true, data: entry });
  } catch (error) {
    console.error("getBlacklistById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blacklist entry",
    });
  }
};

/**
 * PATCH /blacklist/:id/pay-penalty
 * Body: { remarks }
 */
exports.payPenalty = async (req, res) => {
  try {
    const { remarks, payment_method, transaction_id } = req.body;
    const entry = await Blacklist.getById(req.params.id);

    if (!entry) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    if (!entry.has_penalty) {
      return res.status(400).json({
        success: false,
        message: "This entry does not have a penalty",
      });
    }

    if (entry.penalty_status === "PAID") {
      return res.status(400).json({
        success: false,
        message: "Penalty is already paid",
      });
    }

    const updated = await Blacklist.updatePenaltyStatus(
      req.params.id,
      "PAID",
      req.user.userId,
      remarks,
      payment_method || "GATEWAY",
      transaction_id || `TXN-${Date.now()}`
    );

    return res.json({
      success: true,
      message: "Penalty payment recorded",
      data: updated,
    });
  } catch (error) {
    console.error("payPenalty error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record penalty payment",
    });
  }
};

/**
 * PATCH /blacklist/:id/submit-compliance
 * Body: { compliance_notes }
 */
exports.submitCompliance = async (req, res) => {
  try {
    const { compliance_notes } = req.body;

    if (!compliance_notes || !compliance_notes.trim()) {
      return res.status(400).json({
        success: false,
        message: "compliance_notes is required",
      });
    }

    const entry = await Blacklist.getById(req.params.id);

    if (!entry) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    // If penalty is applicable but not yet paid, block compliance submission
    if (entry.has_penalty && entry.penalty_status !== "PAID") {
      return res.status(400).json({
        success: false,
        message: "Penalty must be paid before submitting compliance",
      });
    }

    const updated = await Blacklist.submitCompliance(
      req.params.id,
      compliance_notes,
      req.user.userId
    );

    return res.json({
      success: true,
      message: "Compliance notes submitted",
      data: updated,
    });
  } catch (error) {
    console.error("submitCompliance error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit compliance",
    });
  }
};

/**
 * PATCH /blacklist/:id/request-unblacklist
 * Body: { remarks }
 */
exports.requestUnblacklist = async (req, res) => {
  try {
    const entry = await Blacklist.getById(req.params.id);

    if (!entry) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    if (entry.status !== "BLACKLISTED") {
      return res.status(400).json({
        success: false,
        message: `Cannot request unblacklist — current status is ${entry.status}`,
      });
    }

    // If penalty exists, it must be paid
    if (entry.has_penalty && entry.penalty_status !== "PAID") {
      return res.status(400).json({
        success: false,
        message: "Penalty must be paid before requesting unblacklist",
      });
    }

    const updated = await Blacklist.requestUnblacklist(
      req.params.id,
      req.user.userId,
      req.body.remarks
    );

    return res.json({
      success: true,
      message: "Unblacklist request submitted for Traffic Approval",
      data: updated,
    });
  } catch (error) {
    console.error("requestUnblacklist error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to request unblacklist",
    });
  }
};

/**
 * PATCH /blacklist/:id/approve-unblacklist
 * Body: { remarks }
 */
exports.approveUnblacklist = async (req, res) => {
  try {
    const entry = await Blacklist.getById(req.params.id);

    if (!entry) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    if (entry.status !== "UNBLACKLIST_REQUESTED") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve — current status is ${entry.status}`,
      });
    }

    const updated = await Blacklist.approveUnblacklist(
      req.params.id,
      req.user.userId,
      req.body.remarks
    );

    return res.json({
      success: true,
      message: "Entity has been unblacklisted",
      data: updated,
    });
  } catch (error) {
    console.error("approveUnblacklist error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve unblacklist",
    });
  }
};

/**
 * PATCH /blacklist/:id/reject-unblacklist
 * Body: { remarks }
 */
exports.rejectUnblacklist = async (req, res) => {
  try {
    const { remarks } = req.body;

    if (!remarks || !remarks.trim()) {
      return res.status(400).json({
        success: false,
        message: "Remarks are required when rejecting",
      });
    }

    const entry = await Blacklist.getById(req.params.id);

    if (!entry) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    if (entry.status !== "UNBLACKLIST_REQUESTED") {
      return res.status(400).json({
        success: false,
        message: `Cannot reject — current status is ${entry.status}`,
      });
    }

    const updated = await Blacklist.rejectUnblacklist(
      req.params.id,
      req.user.userId,
      remarks
    );

    return res.json({
      success: true,
      message: "Unblacklist request rejected",
      data: updated,
    });
  } catch (error) {
    console.error("rejectUnblacklist error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject unblacklist",
    });
  }
};

/**
 * GET /blacklist/check?entity_type=VEHICLE&identifier=TN01AB1234
 */
exports.checkBlacklisted = async (req, res) => {
  try {
    const { entity_type, identifier } = req.query;

    if (!entity_type || !identifier) {
      return res.status(400).json({
        success: false,
        message: "entity_type and identifier are required",
      });
    }

    const results = await Blacklist.checkBlacklisted(
      entity_type.toUpperCase(),
      identifier
    );

    return res.json({
      success: true,
      isBlacklisted: results.length > 0,
      data: results,
    });
  } catch (error) {
    console.error("checkBlacklisted error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check blacklist status",
    });
  }
};

/**
 * PATCH /blacklist/:id/direct-unblock
 * Body: { remarks }
 */
exports.directUnblock = async (req, res) => {
  try {
    const { remarks } = req.body;
    const entry = await Blacklist.getById(req.params.id);

    if (!entry) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    const updated = await Blacklist.directUnblock(req.params.id, req.user.userId, remarks);

    // Send email notification on release
    let targetEmail = null;
    let targetName = entry.entity_name || entry.identifier;
    try {
      if (entry.entity_type === 'COMPANY') {
        const userRes = await pool.query('SELECT email, "userName" FROM users WHERE "userName" = $1 OR id::text = $1', [entry.identifier]);
        if (userRes.rows.length > 0) {
          targetEmail = userRes.rows[0].email;
          targetName = userRes.rows[0].userName;
        }
      } else if (entry.entity_type === 'PERSON' || entry.entity_type === 'DRIVER') {
        const passPersonRes = await pool.query('SELECT email, name FROM pass_persons WHERE "aadharNo" = $1 OR "idProofNumber" = $1 LIMIT 1', [entry.identifier]);
        if (passPersonRes.rows.length > 0) {
          targetEmail = passPersonRes.rows[0].email;
          targetName = passPersonRes.rows[0].name;
        }
      }
    } catch (dbErr) {
      console.error("Failed to lookup entity email for unblock:", dbErr);
    }

    if (targetEmail) {
      console.log(`\n==================================================`);
      console.log(`[EMAIL NOTIFICATION] Sending Release alert to: ${targetEmail}`);
      console.log(`Subject: ✅ Chennai Port Reinstatement/Release Confirmation`);
      console.log(`Dear ${targetName},\n\nYou (or your vehicle/driver) has been unblocked/released from blacklisting at Chennai Port.`);
      console.log(`Remarks: ${remarks || "Directly reinstated by ATM"}`);
      console.log(`==================================================\n`);

      try {
        const sendEmailEvent = require("../utils/kafka/producer");
        await sendEmailEvent({
          type: "UNBLACKLISTED",
          email: targetEmail,
          name: targetName,
          identifier: entry.identifier,
          remarks: remarks || "Directly reinstated by ATM"
        });
      } catch (kErr) {
        console.warn("Kafka produce unblacklist email warning:", kErr.message);
      }
    }

    return res.json({
      success: true,
      message: "Entity has been directly unblocked",
      data: updated,
    });
  } catch (error) {
    console.error("directUnblock error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to directly unblock entity",
    });
  }
};

/**
 * PATCH /blacklist/:id/reinstate
 * Body: { justification }
 */
exports.reinstateCompany = async (req, res) => {
  try {
    const { justification } = req.body;

    if (!justification || !justification.trim()) {
      return res.status(400).json({
        success: false,
        message: "justification is required for company reinstatement",
      });
    }

    const entry = await Blacklist.getById(req.params.id);

    if (!entry) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    const updated = await Blacklist.reinstateCompany(req.params.id, req.user.userId, justification);

    // Send email notification on release
    let targetEmail = null;
    let targetName = entry.entity_name || entry.identifier;
    try {
      if (entry.entity_type === 'COMPANY') {
        const userRes = await pool.query('SELECT email, "userName" FROM users WHERE "userName" = $1 OR id::text = $1', [entry.identifier]);
        if (userRes.rows.length > 0) {
          targetEmail = userRes.rows[0].email;
          targetName = userRes.rows[0].userName;
        }
      }
    } catch (dbErr) {
      console.error("Failed to lookup entity email for reinstate:", dbErr);
    }

    if (targetEmail) {
      console.log(`\n==================================================`);
      console.log(`[EMAIL NOTIFICATION] Sending Reinstated alert to: ${targetEmail}`);
      console.log(`Subject: ✅ Chennai Port Company Reinstatement Confirmation`);
      console.log(`Dear ${targetName},\n\nYour company blacklisting has been reversed/reinstated at Chennai Port.`);
      console.log(`Justification: ${justification}`);
      console.log(`==================================================\n`);

      try {
        const sendEmailEvent = require("../utils/kafka/producer");
        await sendEmailEvent({
          type: "UNBLACKLISTED",
          email: targetEmail,
          name: targetName,
          identifier: entry.identifier,
          remarks: justification
        });
      } catch (kErr) {
        console.warn("Kafka produce unblacklist email warning:", kErr.message);
      }
    }

    return res.json({
      success: true,
      message: "Company has been reinstated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("reinstateCompany error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reinstate company",
    });
  }
};

/**
 * POST /blacklist/use-gate-out
 * Body: { vehicleNo }
 */
exports.useGateOut = async (req, res) => {
  try {
    const { vehicleNo } = req.body;

    if (!vehicleNo) {
      return res.status(400).json({
        success: false,
        message: "vehicleNo is required",
      });
    }

    const updated = await Blacklist.useGateOut(vehicleNo);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "No blacklisted vehicle found matching criteria, or final Gate OUT was already used.",
      });
    }

    return res.json({
      success: true,
      message: "One final Gate OUT transaction successfully used.",
      data: updated,
    });
  } catch (error) {
    console.error("useGateOut error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to trigger Gate OUT transaction",
    });
  }
};
