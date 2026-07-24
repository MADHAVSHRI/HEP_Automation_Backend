const User = require("../models/userCreationSchema");
const sendEmailEvent = require("../utils/kafka/producer");
const axios = require("axios");


exports.getMaterialPassRequests = async (req, res) => {
  try {
    const role = req.user.role;
    const departmentId = req.user.departmentId;
    const userId = req.user.id;

    if (role !== "Approval") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortOrder,
      processedByMe,
    } = req.query;

    const userServiceUrl = process.env.USER_SERVICE_URL;

    const response = await axios.get(
      `${userServiceUrl}/api/material-pass/material-pass-requests/${departmentId}`,
      {
        headers: { 
          Authorization: req.headers.authorization,
          "x-service-name": "APPROVAL-SERVICE" 
        },
        params: {
          page,
          limit,
          search,
          status,
          sortOrder,
          processedByMe,
          userId,
        },
      }
    );

    return res.status(response.status).json(response.data);

  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json(error.response.data);
    }

    console.error("Error fetching Material Pass Requests:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch Material Pass Requests",
    });
  }
};


exports.materialPassRequestAction = async (req, res) => {

  const VALID_PASS_TYPES = ["RETURNABLE", "NON_RETURNABLE"];
  const VALID_PASS_DECISIONS = ["APPROVED", "REJECTED", "REVERTED"];  

  try {

    const { passRequestId, passes, decision } = req.body;

    /*
    =====================================================
    VALIDATION
    Material passes bundle multiple pass-type decisions
    (returnable / non-returnable) into a single
    "complete-review" call.
    =====================================================
    */

    if (!decision) {
      return res.status(400).json({
        success: false,
        message: "decision is required"
      });
    }

    if (decision !== "complete-review") {
      return res.status(400).json({
        success: false,
        message: "Invalid decision type"
      });
    }

    if (!passRequestId) {
      return res.status(400).json({
        success: false,
        message: "passRequestId is required for completing review"
      });
    }

    if (!Array.isArray(passes) || passes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "passes array is required and must contain at least one pass"
      });
    }

    for (const pass of passes) {
      const { passType, decision: passDecision, remarks } = pass || {};

      if (!passType || !VALID_PASS_TYPES.includes(passType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid or missing passType: ${passType}`
        });
      }

      if (!passDecision || !VALID_PASS_DECISIONS.includes(passDecision)) {
        return res.status(400).json({
          success: false,
          message: `Invalid or missing decision for passType ${passType}`
        });
      }

      if (
        (passDecision === "REJECTED" || passDecision === "REVERTED") &&
        !remarks?.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: `Remarks are required when ${passDecision.toLowerCase()} for passType ${passType}`
        });
      }
    }

    /*
    =====================================================
    CALL USER SERVICE
    =====================================================
    */

    const userServiceUrl = process.env.USER_SERVICE_URL;

    if (!userServiceUrl) {
      throw new Error("USER_SERVICE_URL not configured");
    }

    const apiUrl = "/api/material-pass/complete-review";

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
    SEND EMAIL NOTIFICATION IF ANY PASS TYPE WAS REVERTED
    =====================================================
    */

    // const hasRevertedPass = passes.some((p) => p.decision === "REVERTED");

    // if (hasRevertedPass) {
    //   // Fire and forget - don't block the response
    //   Promise.resolve().then(async () => {
    //     try {
    //       console.log(`[EMAIL] Starting material pass revert email flow for pass ${passRequestId}`);

    //       const passDetails = await axios.get(
    //         `${userServiceUrl}/api/material-pass/getMaterialPassDetails/${passRequestId}`,
    //         {
    //           headers: {
    //             "x-service-name": "APPROVAL-ADMIN-SERVICE",
    //             Authorization: req.headers.authorization
    //           }
    //         }
    //       );

    //       if (passDetails.data?.success && passDetails.data?.data) {
    //         const passData = passDetails.data.data;
    //         console.log(`[EMAIL] Got pass details, agentEmail: ${passData.agentEmail}, email: ${passData.email}`);

    //         // Build reverted entities directly from the request payload,
    //         // since passType-level status/remarks come from the submitted decision
    //         const revertedEntities = passes
    //           .filter((p) => p.decision === "REVERTED")
    //           .map((p) => ({
    //             type: p.passType,
    //             name: p.passType === "RETURNABLE" ? "Returnable Pass" : "Non-Returnable Pass",
    //             reason: p.remarks || "Correction required"
    //           }));

    //         console.log(`[EMAIL] Found ${revertedEntities.length} reverted pass types`);

    //         const targetEmail = passData.agentEmail || passData.email;
    //         if (!targetEmail) {
    //           console.error("[EMAIL] No email found for material pass request", passRequestId);
    //           return;
    //         }

    //         const emailServiceUrl = process.env.EMAIL_SERVICE_URL || "http://localhost:5002";
    //         const emailResponse = await axios.post(
    //           `${emailServiceUrl}/api/email/sendMaterialPassReverted`,
    //           {
    //             email: targetEmail,
    //             name: passData.agentName || passData.firstName || "Applicant",
    //             referenceNumber: passData.referenceNo,
    //             revertedEntities: revertedEntities,
    //             revertedCount: revertedEntities.length
    //           },
    //           {
    //             headers: {
    //               "x-service-name": "APPROVAL-ADMIN-SERVICE"
    //             },
    //             timeout: 8000
    //           }
    //         );

    //         if (emailResponse.data?.success) {
    //           console.log(`[EMAIL] Successfully sent material pass revert email to ${targetEmail}`);
    //         } else {
    //           console.error(`[EMAIL] Email service returned error:`, emailResponse.data);
    //         }
    //       } else {
    //         console.error("[EMAIL] Failed to get material pass details:", passDetails.data);
    //       }
    //     } catch (emailError) {
    //       console.error("[EMAIL] Failed to send material pass revert notification email:", emailError.message);
    //       console.error("[EMAIL] Error stack:", emailError.stack);
    //     }
    //   });
    // }

    return res.status(200).json(response.data);

  } catch (error) {

    console.error(
      "Material pass request approval/rejection error:",
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