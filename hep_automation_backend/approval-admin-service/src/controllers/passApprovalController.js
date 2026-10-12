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
      (decision === "approve-person" || decision === "reject-person" || decision === "revert-person") &&
      !personId
    ) {
      return res.status(400).json({
        success: false,
        message: "personId is required"
      });
    }

    if (
      (decision === "approve-vehicle" || decision === "reject-vehicle" || decision === "revert-vehicle") &&
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

    // Validate revert decisions
    if (
      (decision === "revert-person" || decision === "revert-vehicle")
    ) {
      const revertReason = req.body.revertReason || req.body.rejectedReason;
      if (!revertReason) {
        return res.status(400).json({
          success: false,
          message: "Revert reason is required when reverting"
        });
      }
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

    if (decision === "revert-person") {
      apiUrl = "/api/pass-request/revert-person";
    }

    if (decision === "approve-vehicle") {
      apiUrl = "/api/pass-request/approve-vehicle";
    }

    if (decision === "reject-vehicle") {
      apiUrl = "/api/pass-request/reject-vehicle";
    }

    if (decision === "revert-vehicle") {
      apiUrl = "/api/pass-request/revert-vehicle";
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
    SEND EMAIL NOTIFICATION IF REVIEW HAS REVERTED OR REJECTED ENTITIES
    =====================================================
    */

    if (decision === "complete-review") {
      // Fire and forget - don't block the response
      Promise.resolve().then(async () => {
        try {
          console.log(`[EMAIL] Starting post-review email flow for pass ${passRequestId}`);
          
          // Fetch pass details to get user email, reverted, and rejected entities info
          const passDetails = await axios.get(
            `${userServiceUrl}/api/pass-request/getPassDetails/${passRequestId}`,
            {
              headers: {
                "x-service-name": "APPROVAL-ADMIN-SERVICE",
                Authorization: req.headers.authorization
              }
            }
          );

          if (passDetails.data?.success && passDetails.data?.data) {
            const passData = passDetails.data.data;
            console.log(`[EMAIL] Got pass details, agentEmail: ${passData.agentEmail}, rawAgentEmail: ${passData.rawAgentEmail}, email: ${passData.email}`);
            
            const targetEmail = passData.rawAgentEmail || passData.agentEmail || passData.email;
            if (!targetEmail) {
              console.error("[EMAIL] No email found for pass request", passRequestId);
              return;
            }

            if (typeof targetEmail === "string" && targetEmail.includes("***")) {
              console.warn(`[EMAIL] Warning: targetEmail ${targetEmail} is masked. Aborting to avoid sending to invalid address.`);
              return;
            }

            const emailServiceUrl = process.env.EMAIL_SERVICE_URL || "http://localhost:5002";

            // Extract reverted entities with their names and reasons
            const revertedEntities = [];
            
            if (passData.persons) {
              passData.persons.forEach(person => {
                if (String(person.status).toLowerCase() === 'reverted') {
                  revertedEntities.push({
                    type: 'person',
                    name: person.name || `Person ${person.id}`,
                    reason: person.rejectedReason || 'Correction required'
                  });
                }
              });
            }
            
            if (passData.vehicles) {
              passData.vehicles.forEach(vehicle => {
                if (String(vehicle.status).toLowerCase() === 'reverted') {
                  revertedEntities.push({
                    type: 'vehicle',
                    name: vehicle.registrationNo || vehicle.regNo || `Vehicle ${vehicle.id}`,
                    reason: vehicle.rejectedReason || 'Correction required'
                  });
                }
              });
            }

            // Extract rejected entities with their names and reasons
            const rejectedEntities = [];

            if (passData.persons) {
              passData.persons.forEach(person => {
                if (String(person.status).toLowerCase() === 'rejected') {
                  rejectedEntities.push({
                    type: 'person',
                    name: person.name || `Person ${person.id}`,
                    reason: person.rejectedReason || 'Application rejected'
                  });
                }
              });
            }

            if (passData.vehicles) {
              passData.vehicles.forEach(vehicle => {
                if (String(vehicle.status).toLowerCase() === 'rejected') {
                  rejectedEntities.push({
                    type: 'vehicle',
                    name: vehicle.registrationNo || vehicle.regNo || `Vehicle ${vehicle.id}`,
                    reason: vehicle.rejectedReason || 'Application rejected'
                  });
                }
              });
            }

            console.log(`[EMAIL] Found ${revertedEntities.length} reverted entities, ${rejectedEntities.length} rejected entities`);

            // Send reverted email if there are reverted entities
            if (revertedEntities.length > 0) {
              try {
                console.log(`[EMAIL] Sending revert email to ${targetEmail} with ${revertedEntities.length} entities`);
                const emailResponse = await axios.post(
                  `${emailServiceUrl}/api/email/sendPassReverted`,
                  {
                    email: targetEmail,
                    name: passData.agentName || passData.firstName || "Applicant",
                    referenceNumber: passData.referenceNo,
                    revertedEntities: revertedEntities,
                    revertedCount: revertedEntities.length
                  },
                  {
                    headers: {
                      "x-service-name": "APPROVAL-ADMIN-SERVICE"
                    },
                    timeout: 8000
                  }
                );

                if (emailResponse.data?.success) {
                  console.log(`[EMAIL] Successfully sent revert email to ${targetEmail}`);
                } else {
                  console.error(`[EMAIL] Email service returned error for revert:`, emailResponse.data);
                }
              } catch (revertErr) {
                console.error(`[EMAIL] Error sending revert email:`, revertErr.message);
              }
            }

            // Send rejected email if there are rejected entities
            if (rejectedEntities.length > 0) {
              try {
                console.log(`[EMAIL] Sending rejection email to ${targetEmail} with ${rejectedEntities.length} entities`);
                const rejectResponse = await axios.post(
                  `${emailServiceUrl}/api/email/sendPassRejected`,
                  {
                    email: targetEmail,
                    name: passData.agentName || passData.firstName || "Applicant",
                    referenceNumber: passData.referenceNo,
                    rejectedEntities: rejectedEntities,
                    rejectedCount: rejectedEntities.length
                  },
                  {
                    headers: {
                      "x-service-name": "APPROVAL-ADMIN-SERVICE"
                    },
                    timeout: 8000
                  }
                );

                if (rejectResponse.data?.success) {
                  console.log(`[EMAIL] Successfully sent rejection email to ${targetEmail}`);
                } else {
                  console.error(`[EMAIL] Email service returned error for rejection:`, rejectResponse.data);
                }
              } catch (rejectErr) {
                console.error(`[EMAIL] Error sending rejection email:`, rejectErr.message);
              }
            }
          } else {
            console.error("[EMAIL] Failed to get pass details:", passDetails.data);
          }
        } catch (emailError) {
          console.error("[EMAIL] Failed to execute post-review email flow:", emailError.message);
          console.error("[EMAIL] Error stack:", emailError.stack);
        }
      });
    }

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