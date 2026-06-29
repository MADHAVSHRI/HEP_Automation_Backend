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

    // 1. Validate Identifier format based on Entity Type
    const cleanIdentifier = identifier.trim().toUpperCase();
    if (entity_type.toUpperCase() === "VEHICLE") {
      const vehicleRegex = /^[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4}$/i;
      if (!vehicleRegex.test(cleanIdentifier)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Vehicle Registration Number format (e.g. TN-01-AB-1234)",
        });
      }
    } else if (entity_type.toUpperCase() === "PERSON") {
      const aadharRegex = /^\d{12}$/;
      if (!aadharRegex.test(cleanIdentifier)) {
        return res.status(400).json({
          success: false,
          message: "Aadhaar Number must be exactly 12 digits",
        });
      }
    } else if (entity_type.toUpperCase() === "DRIVER") {
      const aadharRegex = /^\d{12}$/;
      const dlRegex = /^[A-Z]{2}[0-9]{13}$/i;
      if (!aadharRegex.test(cleanIdentifier) && !dlRegex.test(cleanIdentifier)) {
        return res.status(400).json({
          success: false,
          message: "Driver ID must be a valid 12-digit Aadhaar or a 15-character Driving License (e.g. TN0120200001234)",
        });
      }
    } else if (entity_type.toUpperCase() === "COMPANY") {
      const companyRegex = /^(190\d{6}|[a-zA-Z0-9_-]{3,20})$/;
      if (!companyRegex.test(cleanIdentifier)) {
        return res.status(400).json({
          success: false,
          message: "Company ID must be a 9-digit agent ID starting with 190, or a valid alphanumeric username between 3 and 20 characters",
        });
      }
    }

    // 2. Validate Entity Name (optional)
    const entity_name = req.body.entity_name ? req.body.entity_name.trim() : null;
    if (entity_name) {
      const nameRegex = /^[a-zA-Z\s.-]{2,100}$/;
      if (!nameRegex.test(entity_name)) {
        return res.status(400).json({
          success: false,
          message: "Entity Name can only contain letters, spaces, dots, and hyphens (2-100 characters)",
        });
      }
    }

    // 3. Validate Reason (required, minimum 10 characters)
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Reason description must be at least 10 characters long",
      });
    }

    // 4. Validate Authorizing Officer (required, minimum 3 characters)
    const authorizing_officer = req.body.authorizing_officer ? req.body.authorizing_officer.trim() : null;
    if (!authorizing_officer) {
      return res.status(400).json({
        success: false,
        message: "Authorizing Officer is required",
      });
    }
    const officerRegex = /^[a-zA-Z\s.]{3,50}$/;
    if (!officerRegex.test(authorizing_officer)) {
      return res.status(400).json({
        success: false,
        message: "Authorizing Officer name must be 3-50 characters long and contain only letters, spaces, and dots",
      });
    }

    // 5. Validate Geotag coordinates & Photo Evidence for Unauthorized Parking (Reason Code 001)
    const documentPath = req.file ? `uploads/blacklist/${req.file.filename}` : null;
    if (reason_code === "001") {
      const { geotag_latitude, geotag_longitude } = req.body;
      if (!geotag_latitude || !geotag_longitude) {
        return res.status(400).json({
          success: false,
          message: "Geotagged GPS coordinates are required for Unauthorized Parking (Reason Code 001)",
        });
      }
      if (!documentPath) {
        return res.status(400).json({
          success: false,
          message: "A supporting photograph is required as proof for Unauthorized Parking (Reason Code 001)",
        });
      }
    }

    // Check if entity is already blacklisted or has a pending request
    const existingRes = await pool.query(
      `SELECT id, status, reason FROM blacklist_entries WHERE entity_type = $1 AND identifier = $2 AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED', 'PENDING_BLACKLIST')`,
      [entity_type.toUpperCase(), identifier.toUpperCase().trim()]
    );
    if (existingRes.rows.length > 0) {
      const status = existingRes.rows[0].status;
      let msg = "This entity is already blacklisted";
      if (status === 'PENDING_BLACKLIST') {
        msg = "A blacklisting request for this entity is already pending approval";
      } else if (status === 'UNBLACKLIST_REQUESTED') {
        msg = "This entity is blacklisted (unblacklist request pending approval)";
      }
      return res.status(409).json({
        success: false,
        message: msg,
        data: existingRes.rows[0],
      });
    }



    let has_penalty = req.body.has_penalty === "true" || req.body.has_penalty === true;
    let penalty_amount = req.body.penalty_amount ? parseFloat(req.body.penalty_amount) : 0;

    if (entity_type.toUpperCase() === "VEHICLE") {
      // Chennai Port rule: An amount of Rs. 1025/- (excluding GST) is to be recovered for release of blacklisted vehicles
      if (!has_penalty || penalty_amount < 1025) {
        has_penalty = true;
        penalty_amount = 1025;
      }
    }

    // Determine status based on role. Both Traffic ('Approval') and ATM ('ATM') logins create PENDING_BLACKLIST.
    // Only Admin can directly blacklist immediately without approval.
    let status = 'PENDING_BLACKLIST';
    if (req.user.role === 'Admin') {
      status = 'BLACKLISTED';
    }

    const entry = await Blacklist.createEntry({
      ...req.body,
      entity_type: entity_type.toUpperCase(),
      has_penalty,
      penalty_amount,
      blacklisted_by: req.user.userId,
      supporting_document_path: documentPath,
      status
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
      } else if (entry.entity_type === 'VEHICLE') {
        const passVehRes = await pool.query(`
          SELECT pr.id, u.email, u."userName"
          FROM pass_vehicles pv
          JOIN pass_requests pr ON pv."passRequestId" = pr.id
          JOIN users u ON pr."agentId" = u.id
          WHERE UPPER(TRIM(pv."registrationNo")) = UPPER(TRIM($1))
          ORDER BY pv."createdAt" DESC LIMIT 1
        `, [identifier]);
        if (passVehRes.rows.length > 0) {
          targetEmail = passVehRes.rows[0].email;
          targetName = passVehRes.rows[0].userName;
        }
      }
    } catch (dbErr) {
      console.error("Failed to lookup entity email for blacklist:", dbErr);
    }

    if (targetEmail && entry.status === 'BLACKLISTED') {
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

    // Send email notification on penalty payment
    let targetEmail = null;
    let targetName = updated.entity_name || updated.identifier;
    try {
      if (updated.entity_type === 'COMPANY') {
        const userRes = await pool.query('SELECT email, "userName" FROM users WHERE "userName" = $1 OR id::text = $1', [updated.identifier]);
        if (userRes.rows.length > 0) {
          targetEmail = userRes.rows[0].email;
          targetName = userRes.rows[0].userName;
        }
      } else if (updated.entity_type === 'PERSON' || updated.entity_type === 'DRIVER') {
        const passPersonRes = await pool.query('SELECT email, name FROM pass_persons WHERE "aadharNo" = $1 OR "idProofNumber" = $1 LIMIT 1', [updated.identifier]);
        if (passPersonRes.rows.length > 0) {
          targetEmail = passPersonRes.rows[0].email;
          targetName = passPersonRes.rows[0].name;
        }
      } else if (updated.entity_type === 'VEHICLE') {
        const passVehRes = await pool.query(`
          SELECT pr.id, u.email, u."userName"
          FROM pass_vehicles pv
          JOIN pass_requests pr ON pv."passRequestId" = pr.id
          JOIN users u ON pr."agentId" = u.id
          WHERE UPPER(TRIM(pv."registrationNo")) = UPPER(TRIM($1))
          ORDER BY pv."createdAt" DESC LIMIT 1
        `, [updated.identifier]);
        if (passVehRes.rows.length > 0) {
          targetEmail = passVehRes.rows[0].email;
          targetName = passVehRes.rows[0].userName;
        }
      }
    } catch (dbErr) {
      console.error("Failed to lookup entity email for penalty payment:", dbErr);
    }

    if (targetEmail) {
      console.log(`\n==================================================`);
      console.log(`[EMAIL NOTIFICATION] Sending Penalty Payment confirmation to: ${targetEmail}`);
      console.log(`Subject: ✅ Chennai Port Penalty Payment Confirmation`);
      console.log(`Dear ${targetName},\n\nYour penalty payment of ₹${updated.penalty_amount} for ${updated.entity_type} (${updated.identifier}) has been received successfully.`);
      console.log(`Transaction ID: ${transaction_id || 'N/A'}`);
      console.log(`Payment Method: ${payment_method || 'GATEWAY'}`);
      console.log(`Status: PAID`);
      console.log(`==================================================\n`);

      try {
        const sendEmailEvent = require("../utils/kafka/producer");
        await sendEmailEvent({
          type: "PENALTY_PAID",
          email: targetEmail,
          name: targetName,
          identifier: updated.identifier,
          entity_type: updated.entity_type,
          penalty_amount: updated.penalty_amount,
          transaction_id: transaction_id || 'N/A',
          payment_method: payment_method || 'GATEWAY'
        });
      } catch (kErr) {
        console.warn("Kafka produce penalty paid email warning:", kErr.message);
      }
    }

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

    // If penalty exists AND is applicable, it must be paid
    if (entry.has_penalty && entry.penalty_status !== "PAID" && entry.penalty_status !== "NOT_APPLICABLE") {
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
      } else if (entry.entity_type === 'VEHICLE') {
        const passVehRes = await pool.query(`
          SELECT pr.id, u.email, u."userName"
          FROM pass_vehicles pv
          JOIN pass_requests pr ON pv."passRequestId" = pr.id
          JOIN users u ON pr."agentId" = u.id
          WHERE UPPER(TRIM(pv."registrationNo")) = UPPER(TRIM($1))
          ORDER BY pv."createdAt" DESC LIMIT 1
        `, [entry.identifier]);
        if (passVehRes.rows.length > 0) {
          targetEmail = passVehRes.rows[0].email;
          targetName = passVehRes.rows[0].userName;
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

/**
 * GET /blacklist/my-blacklist
 * Query: { status, entity_type, page, limit }
 */
exports.getMyBlacklistEntries = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, entity_type } = req.query;
    const page = req.query.page ? parseInt(req.query.page, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
    const offset = (page - 1) * limit;

    let baseSql = `
      FROM blacklist_entries b
      WHERE (
        -- 1. Company's own blacklisting
        (b.entity_type = 'COMPANY' AND (
          b.identifier = (SELECT "loginId" FROM "Agents" WHERE id = $1)
          OR b.identifier = (SELECT "userName" FROM users WHERE id = $1)
          OR b.identifier = $1::text
        ))
        -- 2. Vehicles blacklisted that are associated with the agent's pass requests
        OR (b.entity_type = 'VEHICLE' AND b.identifier IN (
          SELECT UPPER(TRIM(pv."registrationNo")) 
          FROM pass_vehicles pv
          JOIN pass_requests pr ON pv."passRequestId" = pr.id
          WHERE pr."agentId" = $1
        ))
        -- 3. Persons blacklisted that are associated with the agent's pass requests
        OR (b.entity_type = 'PERSON' AND b.identifier IN (
          SELECT UPPER(TRIM(pp."aadharNo"))
          FROM pass_persons pp
          JOIN pass_requests pr ON pp."passRequestId" = pr.id
          WHERE pr."agentId" = $1
        ))
        -- 4. Drivers blacklisted that are associated with the agent's pass requests
        OR (b.entity_type = 'DRIVER' AND (
          b.identifier IN (
            SELECT UPPER(TRIM(pp."aadharNo"))
            FROM pass_persons pp
            JOIN pass_requests pr ON pp."passRequestId" = pr.id
            WHERE pr."agentId" = $1
          ) OR b.identifier IN (
            SELECT UPPER(TRIM(pp."idProofNumber"))
            FROM pass_persons pp
            JOIN pass_requests pr ON pp."passRequestId" = pr.id
            WHERE pr."agentId" = $1
          )
        ))
      )
    `;

    let conditions = [];
    let params = [userId];
    let paramIndex = 2;

    if (status) {
      baseSql += ` AND b.status = $${paramIndex++}`;
      params.push(status);
    }
    if (entity_type) {
      baseSql += ` AND b.entity_type = $${paramIndex++}`;
      params.push(entity_type.toUpperCase());
    }

    const countQuery = `SELECT COUNT(DISTINCT b.id) ${baseSql}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT DISTINCT
        b.*,
        u1."userName" AS blacklisted_by_name,
        u2."userName" AS unblacklisted_by_name
      FROM blacklist_entries b
      LEFT JOIN "users" u1 ON b.blacklisted_by = u1.id
      LEFT JOIN "users" u2 ON b.unblacklisted_by = u2.id
      WHERE b.id IN (
        SELECT b.id ${baseSql}
      )
      ORDER BY b."createdAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    params.push(limit, offset);
    const dataResult = await pool.query(dataQuery, params);

    return res.json({
      success: true,
      data: dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("getMyBlacklistEntries error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch agent blacklist entries",
    });
  }
};

/**
 * PATCH /blacklist/:id/approve-blacklist
 */
exports.approveBlacklist = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Authorize ATM Pass Section only
    const isATMPassSection = req.user.role === 'ATM';

    if (!isATMPassSection) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Only the ATM Pass Section can approve blacklisting requests"
      });
    }

    const entryRes = await client.query('SELECT * FROM blacklist_entries WHERE id = $1', [req.params.id]);
    if (entryRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Entry not found" });
    }
    const entry = entryRes.rows[0];
    if (entry.status !== 'PENDING_BLACKLIST') {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: `Cannot approve — current status is ${entry.status}` });
    }

    const updatedRes = await client.query(
      `UPDATE blacklist_entries 
       SET status = 'BLACKLISTED',
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    const updated = updatedRes.rows[0];

    await client.query(
      `INSERT INTO blacklist_audit_log (blacklist_id, action, performed_by, remarks)
       VALUES ($1, 'BLACKLIST_APPROVED', $2, $3)`,
      [req.params.id, req.user.userId, req.body.remarks || "Blacklist request approved by Traffic Department"]
    );

    await client.query("COMMIT");

    // Retrieve details for target email lookup
    let targetEmail = null;
    let targetName = updated.entity_name || updated.identifier;
    try {
      if (updated.entity_type === 'COMPANY') {
        const userRes = await pool.query('SELECT email, "userName" FROM users WHERE "userName" = $1 OR id::text = $1', [updated.identifier]);
        if (userRes.rows.length > 0) {
          targetEmail = userRes.rows[0].email;
          targetName = userRes.rows[0].userName;
        }
      } else if (updated.entity_type === 'PERSON' || updated.entity_type === 'DRIVER') {
        const passPersonRes = await pool.query('SELECT email, name FROM pass_persons WHERE "aadharNo" = $1 OR "idProofNumber" = $1 LIMIT 1', [updated.identifier]);
        if (passPersonRes.rows.length > 0) {
          targetEmail = passPersonRes.rows[0].email;
          targetName = passPersonRes.rows[0].name;
        }
      } else if (updated.entity_type === 'VEHICLE') {
        const passVehRes = await pool.query(`
          SELECT pr.id, u.email, u."userName"
          FROM pass_vehicles pv
          JOIN pass_requests pr ON pv."passRequestId" = pr.id
          JOIN users u ON pr."agentId" = u.id
          WHERE UPPER(TRIM(pv."registrationNo")) = UPPER(TRIM($1))
          ORDER BY pv."createdAt" DESC LIMIT 1
        `, [updated.identifier]);
        if (passVehRes.rows.length > 0) {
          targetEmail = passVehRes.rows[0].email;
          targetName = passVehRes.rows[0].userName;
        }
      }
    } catch (dbErr) {
      console.error("Failed to lookup entity email for blacklist approval:", dbErr);
    }

    if (targetEmail) {
      console.log(`\n==================================================`);
      console.log(`[EMAIL NOTIFICATION] Sending Blacklist alert (Approved) to: ${targetEmail}`);
      console.log(`Subject: ⚠️ Chennai Port Blacklist Notification`);
      console.log(`Dear ${targetName},\n\nYou (or your vehicle/driver) has been blacklisted at Chennai Port.`);
      console.log(`Reason: ${updated.reason} (Code: ${updated.reason_code || '007'})`);
      console.log(`Authorizing Officer: ${updated.authorizing_officer || 'Traffic Department'}`);
      if (updated.has_penalty) {
        console.log(`Penalty Applicable: ₹${updated.penalty_amount}`);
      }
      console.log(`==================================================\n`);

      try {
        const sendEmailEvent = require("../utils/kafka/producer");
        await sendEmailEvent({
          type: "BLACKLISTED",
          email: targetEmail,
          name: targetName,
          identifier: updated.identifier,
          reason: updated.reason,
          reason_code: updated.reason_code || "007",
          penalty_amount: updated.has_penalty ? updated.penalty_amount : null
        });
      } catch (kErr) {
        console.warn("Kafka produce blacklist email warning:", kErr.message);
      }
    }

    return res.json({
      success: true,
      message: "Blacklist request approved",
      data: updated
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("approveBlacklist error:", error);
    return res.status(500).json({ success: false, message: "Failed to approve blacklist request" });
  } finally {
    client.release();
  }
};

/**
 * PATCH /blacklist/:id/reject-blacklist
 */
exports.rejectBlacklist = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Authorize ATM Pass Section only
    const isATMPassSection = req.user.role === 'ATM';

    if (!isATMPassSection) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Only the ATM Pass Section can reject blacklisting requests"
      });
    }

    const entryRes = await client.query('SELECT * FROM blacklist_entries WHERE id = $1', [req.params.id]);
    if (entryRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Entry not found" });
    }
    const entry = entryRes.rows[0];
    if (entry.status !== 'PENDING_BLACKLIST') {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: `Cannot reject — current status is ${entry.status}` });
    }

    const updatedRes = await client.query(
      `UPDATE blacklist_entries 
       SET status = 'REJECTED',
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    const updated = updatedRes.rows[0];

    await client.query(
      `INSERT INTO blacklist_audit_log (blacklist_id, action, performed_by, remarks)
       VALUES ($1, 'BLACKLIST_REJECTED', $2, $3)`,
      [req.params.id, req.user.userId, req.body.remarks || "Blacklist request rejected by Traffic Department"]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Blacklist request rejected",
      data: updated
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("rejectBlacklist error:", error);
    return res.status(500).json({ success: false, message: "Failed to reject blacklist request" });
  } finally {
    client.release();
  }
};

