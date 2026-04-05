const axios = require("axios");
const bcrypt = require("bcrypt");
const User = require("../models/userCreationSchema");

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
      password: hashedPassword
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

exports.getAgentRequests = async (req, res) => {
  try {

    const { isApproved } = req.query;
    const userServiceUrl = process.env.USER_SERVICE_URL;

    // axios config
    const config = {
      headers: {
        "x-service-name": "APPROVAL-SERVICE",
      }
    };

    // only attach query param if provided
    if (isApproved !== undefined) {
      config.params = { isApproved };
    }

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

exports.getDeptAdminUsers = async (req, res) => {

  try {

    const users = await User.getDeptAdminUsers();

    res.status(200).json({
      success: true,
      data: users
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