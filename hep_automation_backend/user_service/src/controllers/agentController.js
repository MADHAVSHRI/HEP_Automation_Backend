const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { successLogger, errorLogger } = require("../logger/logger");
const Agent = require("../models/agentRegistrationSchema");
const captchaService = require("../services/captchaService");
const { changePasswordSchema } = require("../utils/changePasswordValidator");
const bcrypt = require("bcrypt");
const generateLoginId = require("../utils/loginIdGenerator");
const AGENT_STATUS = require("../constants/constants").AGENT_STATUS;
const redisClient = require("../../config/redisClient");
const { generateOtp, saveOtp, getOtp, deleteOtp, MAX_ATTEMPTS } = require("../services/forgotPasswordService");
const forgotPasswordValidator = require("../utils/forgotPasswordValidator");

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
    // const entityFile = req.files?.entityFile?.[0]?.path || null;
    const workOrder = req.files?.workOrder?.[0]?.path || null;
    const requisitionLetter = req.files?.requisitionLetter?.[0]?.path || null;
    const gstinDoc = req.files?.gstinDoc?.[0]?.path || null;
    const panDoc = req.files?.panDoc?.[0]?.path || null;
    const tanDoc = req.files?.tanDoc?.[0]?.path || null;

    if (!workOrder || !requisitionLetter || !gstinDoc || !panDoc) {
      deleteFiles();
      return res.status(400).json({
        success: false,
        message: "Required documents missing",
      });
    }

    const {
      userTypeId,
      userTypeName,
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

    /* ===== PERFORMANCE CHANGE =====
       Run captcha verification and duplicate check in parallel
    */

    const duplicatePromise = Agent.findDuplicate(
      email,
      mobileNo,
      panNumber,
      gstinNumber,
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
      licenseNumber,
      licenseValidityDate,
      addressLine,
      city,
      state,
      pincode,
      country,
      gstinNumber,
      gstinDoc,
      panNumber,
      panDoc,
      tanNumber,
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

    sendEmailEvent({
      email: savedAgent.email,
      name: savedAgent.firstName,
      referenceNumber: savedAgent.referenceNumber,
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

    // Set PDF headers
    res.setHeader("Content-Type", "application/pdf");
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
    const gstinDoc = req.files?.gstinDoc?.[0]?.path || null;
    const panDoc = req.files?.panDoc?.[0]?.path || null;
    const tanDoc = req.files?.tanDoc?.[0]?.path || null;

    const updatePayload = {
      ...req.body,
      workOrder,
      requisitionLetter,
      gstinDoc,
      panDoc,
      tanDoc,
    };

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

    const otp = generateOtp();

    await saveOtp(
      user.loginId,
      otp
    );

    sendEmail("/api/email/sendForgotPasswordOtp", {
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
