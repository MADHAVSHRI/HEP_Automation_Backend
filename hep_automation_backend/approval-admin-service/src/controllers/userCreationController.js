const axios = require("axios");
const bcrypt = require("bcrypt");
const User = require("../models/userCreationSchema");
const sendEmailEvent = require("../utils/kafka/producer");
const {DEPARTMENT_USER_ACCOUNT_STATUS} = require("../constants/constants");
const redisClient = require("../../config/redisClient");

exports.createUser = async (req, res) => {

  try {

    const {
      userName,
      email,
      phoneNumber,
      roleId,
      departmentId
    } = req.body;

    // ===============================
    // REQUIRED FIELD VALIDATION
    // ===============================

    if (!userName || !email || !phoneNumber || !roleId || !departmentId) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // ===============================
    // EMAIL VALIDATION
    // ===============================

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // ===============================
    // PHONE NUMBER VALIDATION
    // ===============================

    const phoneRegex = /^[0-9]{10}$/;

    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be 10 digits"
      });
    }

    // ===============================
    // DEFAULT PASSWORD
    // ===============================

    const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "APPROVAL";

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // ===============================
    // CREATE USER
    // ===============================

    const newUser = await User.createUser({
      userName,
      email,
      phoneNumber,
      roleId,
      departmentId,
      password: hashedPassword,
      status: DEPARTMENT_USER_ACCOUNT_STATUS.INACTIVE
    });
    setImmediate(() => {
      sendEmailEvent({
        type: "DEPT_USER_CREATED",
        email: newUser.email,
        name: newUser.userName,
        status: newUser.status
      }).catch(err => {
        console.error("Kafka Email Event Failed:", err.message);
      });
    });

    // ===============================
    // SUCCESS RESPONSE
    // ===============================

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: newUser
    });

  } catch (error) {

    console.error("User creation error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }

};

exports.getRoles = async (req, res) => {
  const roles = await User.getRoles();

  res.json({
    success: true,
    data: roles,
  });
};

exports.getDepartments = async (req, res) => {
  const departments = await User.getDepartments();

  res.json({
    success: true,
    data: departments,
  });
};
exports.getAgentById = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userServiceUrl = process.env.USER_SERVICE_URL;

    const response = await axios.get(
      `${userServiceUrl}/api/agents/getAgentById/${agentId}`,
      {
        headers: {
          "x-service-name": "APPROVAL-SERVICE",
        },
      }
    );

    return res.status(200).json(response.data);

  } catch (error) {

    if (error.response?.status === 404) {
      return res.status(404).json(error.response.data);
    }

    console.error("Error fetching agent:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch agent",
    });
  }
};
exports.getAgentRequests = async (req, res) => {
  try {

    const userServiceUrl = process.env.USER_SERVICE_URL;

    // axios config
    const config = {
      headers: {
        "x-service-name": "APPROVAL-SERVICE",
      }
    };

    // Forward query parameters
    const { isApproved, page, limit, search, status, processedByMe } = req.query;
    config.params = {
      isApproved,
      page,
      limit,
      search,
      status,
      processedByMe,
      userId: req.user ? req.user.userId : null,
    };

    const response = await axios.get(
      `${userServiceUrl}/api/agents/getAllRegisteredUsers`,
      config
    );

    return res.status(200).json(response.data);

  } catch (error) {

    console.error("Error fetching agents:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch agent registrations",
    });

  }
};

exports.getAgentProfileUpdateRequests = async (req, res) => {
  try {
    const userServiceUrl = process.env.USER_SERVICE_URL;
    const config = {
      headers: {
        "x-service-name": "APPROVAL-SERVICE",
        ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
      },
      params: {
        ...req.query,
        userId: req.user ? req.user.userId : req.query.userId || null,
      },
    };

    const response = await axios.get(
      `${userServiceUrl}/api/agents/getProfileUpdateRequests`,
      config
    );

    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching agent profile update requests:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: "Failed to fetch profile update requests" }
    );
  }
};

exports.actionAgentProfileUpdateRequest = async (req, res) => {
  try {
    const userServiceUrl = process.env.USER_SERVICE_URL;
    const config = {
      headers: {
        "x-service-name": "APPROVAL-SERVICE",
        ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
      },
    };

    const payload = {
      ...req.body,
      requestId: req.body.requestId || req.params.id,
      decision: req.body.decision || req.body.action,
      rejectedReason: req.body.rejectedReason || req.body.remarks,
    };

    const response = await axios.put(
      `${userServiceUrl}/api/agents/actionProfileUpdateRequest`,
      payload,
      config
    );

    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Error actioning agent profile update request:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: "Failed to process profile update action" }
    );
  }
};

exports.viewProfileUpdateDocument = async (req, res) => {
  try {
    const userServiceUrl = process.env.USER_SERVICE_URL;
    const response = await axios.get(
      `${userServiceUrl}/api/agents/viewProfileUpdateDocument`,
      {
        params: req.query,
        responseType: "stream",
      }
    );

    if (response.headers["content-type"]) {
      res.setHeader("Content-Type", response.headers["content-type"]);
    }
    res.setHeader("Content-Disposition", "inline");

    response.data.pipe(res);
  } catch (error) {
    console.error("Error viewing profile update document:", error.message);
    const status = error.response?.status || 500;
    return res.status(status).json({
      success: false,
      message: "Failed to stream profile update document",
    });
  }
};

exports.getDeptAdminUsers = async (req, res) => {

  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const search = req.query.search || "";

    const result = await User.getDeptAdminUsers({ page, limit, search });

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      stats: result.stats
    });

  } catch (error) {

    console.error("Fetch users error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }

};

exports.getAdminUsers = async (req, res) => {

  try {

    const users = await User.getAdminUsers();

    res.status(200).json({
      success: true,
      data: users
    });

  } catch (error) {

    console.error("Fetch admin users error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }

};

exports.agentRequestAction = async (req, res) => {

  try {

    const { agentId, decision, rejectedReason } = req.body;

    if (!agentId || !decision) {
      return res.status(400).json({
        success: false,
        message: "agentId and decision are required"
      });
    }

    if (decision === "rejected" && !rejectedReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting an agent"
      });
    }

    if (decision === "reverted" && !rejectedReason) {
      return res.status(400).json({
        success: false,
        message: "Reason is required when reverting an agent"
      });
    }

    const userServiceUrl = process.env.USER_SERVICE_URL;

    if (!userServiceUrl) {
      throw new Error("USER_SERVICE_URL not configured");
    }

    const response = await axios.put(
      `${userServiceUrl}/api/agents/action`,
      {
        agentId,
        decision,
        rejectedReason
      },
      {
        headers: {
          "x-service-name": "APPROVAL-ADMIN-SERVICE"
        }
      }
    );

    return res.status(200).json(response.data);

  } catch (error) {

    console.error(
      "Agent approval/rejection error:",
      error.response?.data || error.message
    );

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }

};

exports.getAdminUser = async (req, res) => {

  try {

    const { loginId } = req.body;

    if (!loginId) {
      return res.status(400).json({
        success: false,
        message: "loginId required"
      });
    }

    const user = await User.getAdminLoginUser(loginId);

    return res.status(200).json({
      success: true,
      data: user || null
    });

  } catch (error) {

    console.error("Fetch admin login user error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }

};

exports.updateUserApproval = async (req, res) => {

  try {

    const { userId, status } = req.body;

    if (!userId || typeof status !== "boolean") {
      return res.status(400).json({
        success:false,
        message:"userId and status(boolean) required"
      });
    } 

    if (req.user.role !== "Admin") {
      return res.status(403).json({
        success:false,
        message:"Only admin can approve users"
      });
    }

    /* Prevent admin blocking himself */

    if (req.user.userId === userId) {
      return res.status(400).json({
        success:false,
        message:"Admin cannot block himself"
      });
    }

    const updatedUser = await User.updateUserApproval(userId, status);

    if (!updatedUser) {
      return res.status(404).json({
        success:false,
        message:"User not found"
      });
    }

    /* =================================
       KAFKA EVENT FOR EMAIL NOTIFICATION
       ================================= */

    setImmediate(() => {

      sendEmailEvent({
        type: status ? "DEPT_USER_ACTIVATED" : "DEPT_USER_DISABLED",
        email: updatedUser.email,
        name: updatedUser.userName,
        status: updatedUser.status
      }).catch(err => {
        console.error("Kafka email event failed:", err.message);
      });

    });

    return res.status(200).json({
      success:true,
      message: status
        ? "User activated successfully"
        : "User disabled successfully",
      data:updatedUser
    });

  } catch (error) {

    console.error("Approval update error:",error);

    return res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

};

exports.forgotPassword = async (req, res) => {
  const { loginId } = req.body;
  try {
    if (!loginId) {
      return res.status(400).json({ success: false, message: "Email ID is required" });
    }

    const user = await User.findUserByEmail(loginId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Departmental user not found with this email" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await redisClient.set(`otp:user:${loginId}`, otp, { EX: 300 });

    // Dispatch email asynchronously in background to prevent HTTP request block
    axios.post(`${process.env.EMAIL_SERVICE_URL}/api/email/sendForgotPasswordOTP`, {
      email: user.email,
      name: user.userName,
      otp
    }, {
      headers: { "x-service-name": "APPROVAL-ADMIN-SERVICE" }
    })
    .then(() => console.log(`[email] Sent forgot password OTP to ${user.email}`))
    .catch((emailErr) => {
      console.error("Email service error:", emailErr.response?.data || emailErr.message);
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email ID",
      loginId,
      userName: user.userName
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.verifyOtp = async (req, res) => {
  const { loginId, otp } = req.body;
  try {
    if (!loginId || !otp) {
      return res.status(400).json({ success: false, message: "Email ID and OTP are required" });
    }

    const storedOtp = await redisClient.get(`otp:user:${loginId}`);
    if (!storedOtp || storedOtp !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully"
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.resetPassword = async (req, res) => {
  const { loginId, otp, newPassword, confirmPassword } = req.body;
  try {
    if (!loginId || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,15}$/;
    if (!passRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8-15 characters long, contain uppercase, lowercase, a number, and a special character."
      });
    }

    if (newPassword === "APPROVAL") {
      return res.status(400).json({
        success: false,
        message: "New password cannot be APPROVAL"
      });
    }

    const storedOtp = await redisClient.get(`otp:user:${loginId}`);
    if (!storedOtp || storedOtp !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    const user = await User.findUserByEmail(loginId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateUserPassword(user.id, hashedPassword);
    await redisClient.del(`otp:user:${loginId}`);

    return res.status(200).json({
      success: true,
      message: "Password reset successfully"
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.changePassword = async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  const userId = req.user.userId;
  try {
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,15}$/;
    if (!passRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8-15 characters long, contain uppercase, lowercase, a number, and a special character."
      });
    }

    if (newPassword === "APPROVAL") {
      return res.status(400).json({
        success: false,
        message: "New password cannot be APPROVAL"
      });
    }

    const user = await User.findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateUserPassword(user.id, hashedPassword);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully"
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
