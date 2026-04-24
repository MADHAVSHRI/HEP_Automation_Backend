const User = require("../models/userCreationSchema");
const sendEmailEvent = require("../utils/kafka/producer");
const axios = require("axios");

exports.passRequestAction = async (req, res) => {

  try {

    const { passRequestId, personId, vehicleId, decision, rejectedReason } = req.body;

    /*
    =====================================================
    CHANGE START
    Fix validation for person/vehicle approvals
    =====================================================
    */

    if (!decision) {
      return res.status(400).json({
        success: false,
        message: "decision is required"
      });
    }

    if (decision === "complete-review" && !passRequestId) {
      return res.status(400).json({
        success: false,
        message: "passRequestId is required for completing review"
      });
    }

    if (
      (decision === "approve-person" || decision === "reject-person") &&
      !personId
    ) {
      return res.status(400).json({
        success: false,
        message: "personId is required"
      });
    }

    if (
      (decision === "approve-vehicle" || decision === "reject-vehicle") &&
      !vehicleId
    ) {
      return res.status(400).json({
        success: false,
        message: "vehicleId is required"
      });
    }

    if (
      (decision === "reject-person" || decision === "reject-vehicle") &&
      !rejectedReason
    ) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting"
      });
    }

    /*
    =====================================================
    CHANGE END
    =====================================================
    */

    const userServiceUrl = process.env.USER_SERVICE_URL;

    if (!userServiceUrl) {
      throw new Error("USER_SERVICE_URL not configured");
    }

    /*
    =====================================================
    CHANGE START
    Map decision → correct API
    =====================================================
    */

    let apiUrl = "";

    if (decision === "approve-person") {
      apiUrl = "/api/pass-request/approve-person";
    }

    if (decision === "reject-person") {
      apiUrl = "/api/pass-request/reject-person";
    }

    if (decision === "approve-vehicle") {
      apiUrl = "/api/pass-request/approve-vehicle";
    }

    if (decision === "reject-vehicle") {
      apiUrl = "/api/pass-request/reject-vehicle";
    }

    if (decision === "complete-review") {
      apiUrl = "/api/pass-request/complete-review";
    }

    if (!apiUrl) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision type"
      });
    }

    /*
    =====================================================
    CALL USER SERVICE
    =====================================================
    */

    const response = await axios.put(
      `${userServiceUrl}${apiUrl}`,
      req.body,
      {
        headers: {
          "x-service-name": "APPROVAL-ADMIN-SERVICE",
          Authorization: req.headers.authorization
        }
      }
    );

    /*
    =====================================================
    CHANGE END
    =====================================================
    */

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