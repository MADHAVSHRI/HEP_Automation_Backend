const User = require("../models/userCreationSchema");
const sendEmailEvent = require("../utils/kafka/producer");
const axios = require("axios");

exports.passRequestAction = async (req, res) => {

  try {

    const { passRequestId, decision, rejectedReason } = req.body;

    if (!passRequestId || !decision) {
      return res.status(400).json({
        success: false,
        message: "passRequestId and decision are required"
      });
    }

    if (decision === "rejected" && !rejectedReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting a pass request"
      });
    }

    const userServiceUrl = process.env.USER_SERVICE_URL;

    if (!userServiceUrl) {
      throw new Error("USER_SERVICE_URL not configured");
    }

    /*
    =====================================================
    CALL USER SERVICE
    =====================================================
    */

    const response = await axios.put(
      `${userServiceUrl}/api/pass-request/action`,
      {
        passRequestId,
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
      "Pass request approval/rejection error:",
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