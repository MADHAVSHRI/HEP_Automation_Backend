const fs = require("fs");
const path = require("path");
const axios = require("axios");
const {sendEmailEvent, sendSmsEvent} = require("../utils/kafka/producer");
const { successLogger, errorLogger } = require("../logger/logger");
const Agent = require("../models/agentRegistrationSchema");
const captchaService = require("../services/captchaService");
const { changePasswordSchema } = require("../utils/changePasswordValidator");
const bcrypt = require("bcrypt");
const generateLoginId = require("../utils/loginIdGenerator");
const AGENT_STATUS = require("../constants/constants").AGENT_STATUS;
const redisClient = require("../../config/redisClient");
const { generateOtp, saveOtp, getOtp, deleteOtp, MAX_ATTEMPTS, canSendOtp, setCooldown, incrementOtpCounter } = require("../services/forgotPasswordService");
const forgotPasswordValidator = require("../utils/forgotPasswordValidator");
const { pool } = require("../dbconfig/db");

exports.registerAgent = async (req, res) => {
  const deleteFiles = () => {
    const files = req.files || {};

    Object.values(files).forEach((fileArray) => {
      fileArray.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlink(file.path, (err) => {
            if (err) console.error("File delete error:", err);
          });
        }
      });
    });
  };

  try {
    const { userTypeName } = req.body;
    const workOrder = req.files?.workOrder?.[0]?.path || null;
    const requisitionLetter = req.files?.requisitionLetter?.[0]?.path || null;
    const licenseDoc = req.files?.licenseDoc?.[0]?.path || null;
    const gstinDoc = req.files?.gstinDoc?.[0]?.path || null;
    const panDoc = req.files?.panDoc?.[0]?.path || null;
    const tanDoc = req.files?.tanDoc?.[0]?.path || null;

    const TRANSPORT_KEYWORDS = [
      "transport", "truck", "trailer", "logistics",
      "fleet", "lorry", "carrier", "haulage",
    ];
    const isTransportUser = userTypeName && TRANSPORT_KEYWORDS.some((kw) => 
      String(userTypeName).toLowerCase().includes(kw)
    );
    const isGovtUser = userTypeName && (
      String(userTypeName).toLowerCase().includes("govt") || 
      String(userTypeName).toLowerCase().includes("government")
    );

    let isMissingDocs = false;
    if (isGovtUser) {
      isMissingDocs = false;
    } else if (isTransportUser) {
      isMissingDocs = !requisitionLetter || !panDoc;
    } else {
      isMissingDocs = !workOrder || !requisitionLetter || !gstinDoc || !panDoc || !licenseDoc;
    }

    if (isMissingDocs) {
      deleteFiles();
      return res.status(400).json({
        success: false,
        message: "Required documents missing",
      });
    }

    const {
      userTypeId,
      entityName,
      mobileNo,
      email,
      licenseNumber,
      licenseValidityDate,
      addressLine,
      city,
      state,
      pincode,
      country,
      gstinNumber,
      panNumber,
      tanNumber,
      remark,
      title,
      firstName,
      lastName,
      contactMobile,
      contactEmail,
      termsAccepted: rawTermsAccepted,
      captchaToken,
      captchaValue,
    } = req.body;

    const normalizedGstinNumber = gstinNumber && gstinNumber.trim() !== "" ? gstinNumber.trim() : null;
    const normalizedPanNumber = panNumber && panNumber.trim() !== "" ? panNumber.trim() : null;
    const normalizedTanNumber = tanNumber && tanNumber.trim() !== "" ? tanNumber.trim() : null;
    const normalizedLicenseNumber = licenseNumber && licenseNumber.trim() !== "" ? licenseNumber.trim() : "";
    const normalizedLicenseValidityDate = licenseValidityDate && licenseValidityDate.trim() !== "" ? licenseValidityDate : null;

    /* ===== PERFORMANCE CHANGE =====
       Run captcha verification and duplicate check in parallel
    */

    const duplicatePromise = Agent.findDuplicate(
      email,
      mobileNo,
      normalizedPanNumber,
      normalizedGstinNumber,
    );

    const captchaPromise = captchaService.verifyCaptcha(
      captchaToken,
      captchaValue,
    );

    const [existingAgent, validCaptcha] = await Promise.all([
      duplicatePromise,
      captchaPromise,
    ]);

    if (!validCaptcha) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired captcha",
      });
    }

    const termsAccepted =
      String(rawTermsAccepted).trim().toLowerCase() === "true";

    if (!userTypeId || !entityName || !mobileNo || !email) {
      deleteFiles();
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (!termsAccepted) {
      deleteFiles();
      return res.status(400).json({
        success: false,
        message: "You must accept Terms & Conditions",
      });
    }

    if (existingAgent) {
      deleteFiles();
      return res.status(409).json({
        success: false,
        message: "User already registered with same email/mobile/PAN",
      });
    }

    const savedAgent = await Agent.create({
      userTypeId,
      userTypeName,
      entityName,
      mobileNo,
      email,
      workOrder,
      requisitionLetter,
      licenseNumber: normalizedLicenseNumber,
      licenseValidityDate: normalizedLicenseValidityDate,
      licenseDoc,
      addressLine,
      city,
      state,
      pincode,
      country,
      gstinNumber: normalizedGstinNumber,
      gstinDoc,
      panNumber: normalizedPanNumber,
      panDoc,
      tanNumber: normalizedTanNumber,
      tanDoc,
      remark,
      title,
      firstName,
      lastName,
      contactMobile,
      contactEmail,
      termsAccepted,
    });

    /* ===== PERFORMANCE CHANGE =====
       Email event pushed to Kafka immediately
       (API does not wait for email service)
    */

    // sendEmailEvent({
    //   email: savedAgent.email,
    //   name: savedAgent.firstName,
    //   referenceNumber: savedAgent.referenceNumber,
    // });

    await sendEmailEvent({
      email: savedAgent.email,
      name: savedAgent.firstName,
      referenceNumber: savedAgent.referenceNumber,
    });

    await sendSmsEvent({
      type: "agent-registration-sms",
      mobileNumber: savedAgent.mobileNo,
      username: savedAgent.firstName,
      requestId: savedAgent.referenceNumber,
      status: savedAgent.status
    });

    res.status(201).json({
      success: true,
      message: "Agent registered successfully",
      referenceNumber: savedAgent.referenceNumber,
      data: savedAgent,
    });
  } catch (error) {
    deleteFiles();

    console.error("Agent Registration Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.updateEmailStatus = async (req, res) => {
  try {
    const { referenceNumber } = req.body;

    if (!referenceNumber) {
      return res.status(400).json({
        success: false,
        message: "referenceNumber required",
      });
    }

    await Agent.updateEmailStatusByReference(referenceNumber);

    res.json({
      success: true,
      message: "Email status updated",
    });
  } catch (error) {
    console.error("Update Email Status Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.updateCredentialEmailStatus = async (req, res) => {
  try {
    const { agentId } = req.body;

    await Agent.updateCredentialEmailStatus(agentId);

    return res.json({
      success: true,
      message: "Email status updated",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to update email status",
    });
  }
};

exports.getAllRegisteredUsers = async (req, res) => {
  try {
    const { isApproved, search, status, processedByMe, userId } = req.query;

    const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
    const pag = getPagination(req.query);

    const paginationParams = {
      ...pag,
      isApproved,
      status,
      search: search || undefined,
      processedByMe: processedByMe === "true" || processedByMe === true,
      userId: userId || null,
    };

    const result = await Agent.getAllRegisteredAgents(paginationParams);

    // Compute the correct total records for the paginated tab
    let totalRecordsForTab = result.counts.total;
    if (status === "pending") {
      totalRecordsForTab = result.counts.pending;
    } else if (status === "processed") {
      totalRecordsForTab = result.counts.total - result.counts.pending;
    } else if (status === "approved" || status === "rejected") {
      totalRecordsForTab = result.counts[status] || 0;
    }

    return res.status(200).json(
      buildPaginatedResponse(
        result.data,
        result.counts,
        totalRecordsForTab,
        pag.page,
        pag.limit
      )
    );
  } catch (error) {
    console.error("Fetch agents error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch agents",
    });
  }
};

exports.getAgentDetailsById = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await Agent.getAgentDetailsById(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found or not approved",
      });
    }

    return res.status(200).json({
      success: true,
      data: agent,
    });
  } catch (error) {
    console.error("Fetch agent profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getAgentProfile = async (req, res) => {
  try {
    const agentId = req.user.userId;

    const agent = await Agent.getAgentById(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found or not approved",
      });
    }

    // Check if the company is blacklisted
    const blacklistRes = await pool.query(
      "SELECT id, reason FROM blacklist_entries WHERE entity_type = 'COMPANY' AND (UPPER(identifier) = UPPER($1) OR identifier = $2) AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED')",
      [agent.loginId, String(agent.id)]
    );

    const isBlacklisted = blacklistRes.rows.length > 0;
    const blacklistReason = isBlacklisted ? blacklistRes.rows[0].reason : null;

    // Check if any company vehicles are blacklisted
    const vehiclesRes = await pool.query(
      `SELECT "registrationNo" FROM master_vehicles WHERE "agentId" = $1
       UNION
       SELECT pv."registrationNo" 
       FROM pass_vehicles pv
       JOIN pass_requests pr ON pv."passRequestId" = pr.id
       WHERE pr."agentId" = $1`,
      [agentId]
    );
    let blacklistedVehicles = [];
    if (vehiclesRes.rows.length > 0) {
      const regNos = vehiclesRes.rows
        .map(r => r.registrationNo ? r.registrationNo.toUpperCase().trim() : null)
        .filter(Boolean);
      if (regNos.length > 0) {
        const normalizedRegNos = regNos.map(no => no.replace(/\s/g, '').replace(/-/g, ''));
        const vehicleBlacklistRes = await pool.query(
          "SELECT identifier, reason, status FROM blacklist_entries WHERE entity_type = 'VEHICLE' AND REPLACE(REPLACE(UPPER(identifier), ' ', ''), '-', '') = ANY($1) AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED', 'PENDING_BLACKLIST')",
          [normalizedRegNos]
        );
        blacklistedVehicles = vehicleBlacklistRes.rows;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        ...agent,
        isBlacklisted,
        blacklistReason,
        blacklistedVehicles
      },
    });
  } catch (error) {
    console.error("Fetch agent profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.agentAction = async (req, res) => {
  try {
    const { agentId, decision, rejectedReason } = req.body;
    const userId = req.user ? req.user.userId : null;

    console.log("Service Header:", req.headers["x-service-name"]);

    const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "APPROVAL";

    if (!agentId || !decision) {
      return res.status(400).json({
        success: false,
        message: "Agent ID and decision required",
      });
    }

    /*
    =====================================================
    APPROVE AGENT
    =====================================================
    */

    if (decision === AGENT_STATUS.APPROVED) {
      const loginId = generateLoginId();

      const hashedPassword = await bcrypt.hash(defaultPassword, 8);

      const agent = await Agent.approveAgent(agentId, loginId, hashedPassword, userId);

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: "Agent not found",
        });
      }

      /*
      =====================================================
      PUSH EMAIL EVENT TO KAFKA
      =====================================================
      */

      await sendEmailEvent({
        type: "APPROVAL",
        agentId,
        email: agent.email,
        name: agent.firstName,
        loginId,
        password: defaultPassword,
      });

      return res.json({
        success: true,
        message: "Agent approved successfully",
      });
    }

    /*
    =====================================================
    REJECT AGENT
    =====================================================
    */

    if (decision === AGENT_STATUS.REJECTED && rejectedReason) {
      const agent = await Agent.rejectAgent(agentId, rejectedReason, userId);

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: "Agent not found",
        });
      }

      if (!agent.rejectedReason) {
        return res.status(500).json({
          success: false,
          message: "Rejection reason not stored",
        });
      }

      await sendEmailEvent({
        type: "REJECTION",
        agentId,
        email: agent.email,
        name: agent.firstName,
        referenceNumber: agent.referenceNumber,
        reason: agent.rejectedReason,
      });

      return res.status(201).json({
        success: true,
        message: "Agent rejected successfully",
      });
    }

    /*
    =====================================================
    REVERT AGENT
    =====================================================
    */

    if (decision === AGENT_STATUS.REVERTED && rejectedReason) {
      const agent = await Agent.revertAgent(agentId, rejectedReason, userId);

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: "Agent not found",
        });
      }

      await sendEmailEvent({
        type: "REVERTED",
        agentId,
        email: agent.email,
        name: agent.firstName,
        referenceNumber: agent.referenceNumber,
        reason: rejectedReason,
      });

      return res.status(200).json({
        success: true,
        message: "Agent reverted successfully",
      });
    }
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getLoginUser = async (req, res) => {
  try {
    const { loginId } = req.body;

    if (!loginId) {
      return res.status(400).json({
        success: false,
        message: "loginId required",
      });
    }

    const user = await Agent.getLoginUser(loginId);

    return res.status(200).json({
      success: true,
      data: user || null,
    });
  } catch (error) {
    console.error("Fetch login user error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.trackRequest = async (req, res) => {
  try {
    const { referenceNumber } = req.query;

    if (!referenceNumber) {
      return res.status(400).json({
        success: false,
        message: "Reference Number not found",
      });
    }

    const request = await Agent.trackRequest(referenceNumber);

    return res.status(200).json({
      success: true,
      data: request || null,
    });
  } catch (error) {
    console.error("Track request error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.viewAgentDocument = async (req, res) => {
  try {
    const { referenceNumber, documentType } = req.query;

    if (!referenceNumber || !documentType) {
      return res.status(400).json({
        success: false,
        message: "referenceNumber and documentType required",
      });
    }

    const fileData = await Agent.getDocumentPath(referenceNumber, documentType);

    if (!fileData) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const filePath = Object.values(fileData)[0];

    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: "File path not found",
      });
    }

    const absolutePath = path.join(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "File missing on server",
      });
    }

    let contentType = "application/octet-stream";
    try {
      const fd = fs.openSync(absolutePath, "r");
      const buffer = Buffer.alloc(4);
      fs.readSync(fd, buffer, 0, 4, 0);
      fs.closeSync(fd);

      // Check magic bytes:
      // PDF: %PDF (0x25 0x50 0x44 0x46)
      // PNG: 0x89 0x50 0x4E 0x47
      // JPEG: 0xFF 0xD8 0xFF
      if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        contentType = "application/pdf";
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        contentType = "image/png";
      } else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        contentType = "image/jpeg";
      } else {
        const pathExt = path.extname(absolutePath).toLowerCase();
        if (pathExt === ".pdf") contentType = "application/pdf";
        if (pathExt === ".jpg" || pathExt === ".jpeg") contentType = "image/jpeg";
        if (pathExt === ".png") contentType = "image/png";
      }
    } catch (err) {
      console.error("Error reading file magic bytes, falling back to extension:", err);
      const pathExt = path.extname(absolutePath).toLowerCase();
      if (pathExt === ".pdf") contentType = "application/pdf";
      if (pathExt === ".jpg" || pathExt === ".jpeg") contentType = "image/jpeg";
      if (pathExt === ".png") contentType = "image/png";
    }

    // Set headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");

    // Create stream
    const stream = fs.createReadStream(absolutePath);

    // Handle stream error
    stream.on("error", (error) => {
      console.error("Stream error:", error);
      res.status(500).end("Error reading file");
    });

    // Pipe stream to response
    stream.pipe(res);
  } catch (error) {
    console.error("View document error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.updateAgentByReference = async (req, res) => {
  const deleteUploadedFiles = () => {
    const files = req.files || {};

    Object.values(files).forEach((arr) => {
      arr.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    });
  };

  try {
    const { referenceNumber } = req.body;

    if (!referenceNumber) {
      deleteUploadedFiles();
      return res.status(400).json({
        success: false,
        message: "referenceNumber is required",
      });
    }

    const workOrder = req.files?.workOrder?.[0]?.path || null;
    const requisitionLetter = req.files?.requisitionLetter?.[0]?.path || null;
    const licenseDoc = req.files?.licenseDoc?.[0]?.path || null;
    const gstinDoc = req.files?.gstinDoc?.[0]?.path || null;
    const panDoc = req.files?.panDoc?.[0]?.path || null;
    const tanDoc = req.files?.tanDoc?.[0]?.path || null;

    const gstinNumber = req.body.gstinNumber;
    const panNumber = req.body.panNumber;
    const tanNumber = req.body.tanNumber;
    const licenseNumber = req.body.licenseNumber;
    const licenseValidityDate = req.body.licenseValidityDate;

    const normalizedGstinNumber = gstinNumber !== undefined ? (gstinNumber && gstinNumber.trim() !== "" ? gstinNumber.trim() : null) : undefined;
    const normalizedPanNumber = panNumber !== undefined ? (panNumber && panNumber.trim() !== "" ? panNumber.trim() : null) : undefined;
    const normalizedTanNumber = tanNumber !== undefined ? (tanNumber && tanNumber.trim() !== "" ? tanNumber.trim() : null) : undefined;
    const normalizedLicenseNumber = licenseNumber !== undefined ? (licenseNumber && licenseNumber.trim() !== "" ? licenseNumber.trim() : "") : undefined;
    const normalizedLicenseValidityDate = licenseValidityDate !== undefined ? (licenseValidityDate && licenseValidityDate.trim() !== "" ? licenseValidityDate : null) : undefined;

    const updatePayload = {
      ...req.body,
      workOrder,
      requisitionLetter,
      licenseDoc,
      gstinDoc,
      panDoc,
      tanDoc,
    };

    if (normalizedGstinNumber !== undefined) updatePayload.gstinNumber = normalizedGstinNumber;
    if (normalizedPanNumber !== undefined) updatePayload.panNumber = normalizedPanNumber;
    if (normalizedTanNumber !== undefined) updatePayload.tanNumber = normalizedTanNumber;
    if (normalizedLicenseNumber !== undefined) updatePayload.licenseNumber = normalizedLicenseNumber;
    if (normalizedLicenseValidityDate !== undefined) updatePayload.licenseValidityDate = normalizedLicenseValidityDate;

    const updated = await Agent.updateAgentByReference(
      referenceNumber,
      updatePayload,
    );

    if (!updated.success) {
      deleteUploadedFiles();

      return res.status(400).json({
        success: false,
        message: updated.message,
      });
    }

    await sendEmailEvent({
      type: "UPDATED_AFTER_REVERT",
      email: updated.data.email,
      name: updated.data.firstName,
      referenceNumber: updated.data.referenceNumber,
    });

    res.status(200).json({
      success: true,
      message: "Agent updated successfully and sent for approval",
      data: updated.data,
    });
  } catch (error) {
    deleteUploadedFiles();

    console.error("Agent Update Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const validation = changePasswordSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message:
          validation.error.issues?.[0]?.message ||
          "Validation failed",
      });
    }

    const { loginId, newPassword } = validation.data;

    // Security check: ensure current user has rights to modify this account
    const agent = await Agent.getAgentById(req.user.userId);
    if (!agent || agent.loginId !== loginId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to change password for this account",
      });
    }

    const result = await Agent.changePassword(loginId, newPassword);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Change Password Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.sendForgotPasswordOtp = async (req, res) => {

  try {

    const { identifier } = req.body;

    const user =
      await Agent.findAgentByIdentifier(
        identifier
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isApproved) {
      return res.status(403).json({
        success: false,
        message: "User is not active. Please contact administrator.",
      });
    }

    if (
  !(await canSendOtp(
    user.loginId
  ))
) {

  return res.status(429).json({
    success: false,
    message:
      "Please wait 60 seconds before requesting another OTP"
  });

}

  if (
  !(await canSendOtp(
    user.loginId
  ))
) {

  return res.status(429).json({
    success: false,
    message:
      "Please wait 60 seconds before requesting another OTP"
  });

}

  const otp = generateOtp();

    await saveOtp(
      user.loginId,
      otp
    );

    await sendEmailEvent({
      type: "FORGOT_PASSWORD_OTP",
      email: user.email,
      name: user.firstName,
      otp,
    });


    return res.json({
      success: true,
      message:
        "OTP sent successfully",
      loginId: user.loginId,
      userName: user.loginId
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });

  }

};

exports.verifyForgotPasswordOtp = async (req, res) => {

  try {
    const {
      identifier,
      otp,
    } = req.body;

    const user =
      await Agent.findAgentByIdentifier(
        identifier
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const data =
      await getOtp(user.loginId);

    if (!data) {

      return res.status(400).json({
        success: false,
        message:
          "OTP expired",
      });

    }

    if (data.otp !== otp) {

      data.attempts += 1;

      if (
        data.attempts >=
        MAX_ATTEMPTS
      ) {

        await deleteOtp(
          user.loginId
        );

      } else {

        await saveOtp(
          user.loginId,
          data.otp,
          data
        );

      }

      return res.status(400).json({
        success: false,
        message:
          "Invalid OTP",
      });

    }

    /* ===== MY CHANGE START ===== */

    data.verified = true;

    await saveOtp(
      user.loginId,
      data.otp,
      data
    );

    /* ===== MY CHANGE END ===== */

    return res.json({
      success: true,
      message:
        "OTP verified",
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });

  }

};

exports.resetForgotPassword = async (req, res) => {

  try {

    const validation =
      forgotPasswordValidator.safeParse(
        req.body
      );

    if (!validation.success) {

      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message || "Validation Failed",
      });

    }

    const {
      identifier,
      otp,
      newPassword,
    } = validation.data;

    const user =
      await Agent.findAgentByIdentifier(
        identifier
      );

    if (!user) {

      return res.status(404).json({
        success: false,
        message: "User not found",
      });

    }

    const data =
      await getOtp(user.loginId);

    if (!data) {

      return res.status(400).json({
        success: false,
        message:
          "OTP expired",
      });

    }

    if (data.otp !== otp) {

      return res.status(400).json({
        success: false,
        message:
          "Invalid OTP",
      });

    }

    /* ===== MY CHANGE START ===== */

    if (!data.verified) {

      return res.status(400).json({
        success: false,
        message:
          "OTP verification required",
      });

    }

    /* ===== MY CHANGE END ===== */


    if (!user) {

      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });

    }

    const hash =
      await bcrypt.hash(
        newPassword,
        12
      );

    await Agent
      .updateForgotPassword(
        user.loginId,
        hash
      );

    await deleteOtp(
      user.loginId
    );

    return res.json({
      success: true,
      message:
        "Password reset successfully",
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });

  }

};
