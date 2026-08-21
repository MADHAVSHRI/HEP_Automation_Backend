const BulkPassParentRequest = require("../models/BulkPassParentRequest");
const { pool } = require("../dbconfig/db");
const axios = require("axios");
const { generateUploadToken, encryptToken } = require("../utils/tokenUtils");

/**
 * Admin Public Request Controller
 * 
 * Handles General Administrator operations for public website-initiated bulk pass requests.
 * 
 * Operations:
 * - Get pending/filtered public requests with pagination
 * - Get public request detail with associated user data
 * - Approve public requests (generate upload links)
 * - Reject public requests with reasons
 * 
 * Requirements: 25.1-25.6, 26.1-26.5
 */

/**
 * Get Pending Public Requests
 * 
 * Retrieves a paginated list of public bulk pass requests with optional filtering.
 * 
 * Query Parameters:
 * - status: Filter by status (PENDING_ADMIN_APPROVAL, ACTIVE, REJECTED_BY_ADMIN)
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20)
 * - search: Search by company name, email, or tracking number
 * 
 * Authentication: Required (JWT with GENERAL_ADMIN role)
 * 
 * Requirements: 25.1, 25.2, 25.3
 * 
 * @route GET /api/bulk-pass/admin/public-requests
 * @access Private (GENERAL_ADMIN role)
 */
exports.getPendingRequests = async (req, res) => {
  try {
    console.log(`[ADMIN-PUBLIC-REQUEST] Get requests called by user: ${req.user?.id}`);

    // Parse query parameters
    const status = req.query.status || 'PENDING_ADMIN_APPROVAL';
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const search = req.query.search || null;

    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({
        success: false,
        message: "Page number must be at least 1"
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100"
      });
    }

    // Validate status filter
    const validStatuses = ['PENDING_ADMIN_APPROVAL', 'ACTIVE', 'REJECTED_BY_ADMIN', 'EXPIRED'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    console.log(`[ADMIN-PUBLIC-REQUEST] Filters - status: ${status}, page: ${page}, limit: ${limit}, search: ${search || 'none'}`);

    // Build filters object
    const filters = {};
    if (status) {
      filters.status = status;
    }
    if (search) {
      filters.search = search;
    }

    // Query bulk_pass_parent_requests with filters
    const allRequests = await BulkPassParentRequest.list(filters);

    // Calculate pagination
    const total = allRequests.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    // Apply pagination
    const paginatedRequests = allRequests.slice(startIndex, endIndex);

    console.log(`[ADMIN-PUBLIC-REQUEST] Found ${total} requests, returning page ${page}/${totalPages}`);

    // Return list of requests with relevant fields
    const requests = paginatedRequests.map(request => ({
      id: request.id,
      tracking_number: request.tracking_number,
      company_name: request.company_name,
      applicant_email: request.applicant_email,
      applicant_mobile: request.applicant_mobile,
      no_of_persons: request.no_of_persons,
      no_of_vehicles: request.no_of_vehicles,
      validity_from: request.validity_from,
      validity_upto: request.validity_upto,
      purpose: request.purpose,
      status: request.status,
      created_at: request.created_at,
      approved_at: request.approved_at,
      rejected_at: request.rejected_at,
      rejection_reason: request.rejection_reason
    }));

    // Return response with pagination metadata
    return res.status(200).json({
      success: true,
      requests: requests,
      pagination: {
        total: total,
        page: page,
        limit: limit,
        totalPages: totalPages
      }
    });

  } catch (error) {
    console.error("[ADMIN-PUBLIC-REQUEST] getPendingRequests error:", error);

    return res.status(500).json({
      success: false,
      message: `Failed to fetch requests: ${error.message}`,
      errorDetails: error.message
    });
  }
};

/**
 * Get Public Request Detail
 * 
 * Retrieves complete details of a single public bulk pass request including:
 * - All request information
 * - Associated user data (approved_by, rejected_by)
 * - Child batch submissions (if any)
 * 
 * Authentication: Required (JWT)
 * 
 * Requirements: 25.1
 * 
 * @route GET /api/bulk-pass/admin/public-requests/:id
 * @access Private (GENERAL_ADMIN role)
 */
exports.getRequestDetail = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);

    console.log(`[ADMIN-PUBLIC-REQUEST] Get request detail for ID: ${requestId} by user: ${req.user?.id}`);

    // Validate request ID
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID"
      });
    }

    // Query bulk_pass_parent_requests by ID
    const parentRequest = await BulkPassParentRequest.getById(requestId);

    // Handle 404 Not Found if request doesn't exist
    if (!parentRequest) {
      console.log(`[ADMIN-PUBLIC-REQUEST] Request not found: ${requestId}`);
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    // Include associated user data (approved_by, rejected_by)
    let approvedByUser = null;
    let rejectedByUser = null;

    // Fetch approved_by user data if exists
    if (parentRequest.approved_by_user_id) {
      try {
        const approvedByResult = await pool.query(
          `SELECT id, "userName", email FROM users WHERE id = $1`,
          [parentRequest.approved_by_user_id]
        );
        if (approvedByResult.rows.length > 0) {
          approvedByUser = {
            id: approvedByResult.rows[0].id,
            userName: approvedByResult.rows[0].userName,
            email: approvedByResult.rows[0].email
          };
        }
      } catch (error) {
        console.error("[ADMIN-PUBLIC-REQUEST] Error fetching approved_by user:", error);
        // Continue without user data
      }
    }

    // Fetch rejected_by user data if exists
    if (parentRequest.rejected_by_user_id) {
      try {
        const rejectedByResult = await pool.query(
          `SELECT id, "userName", email FROM users WHERE id = $1`,
          [parentRequest.rejected_by_user_id]
        );
        if (rejectedByResult.rows.length > 0) {
          rejectedByUser = {
            id: rejectedByResult.rows[0].id,
            userName: rejectedByResult.rows[0].userName,
            email: rejectedByResult.rows[0].email
          };
        }
      } catch (error) {
        console.error("[ADMIN-PUBLIC-REQUEST] Error fetching rejected_by user:", error);
        // Continue without user data
      }
    }

    // Get child batch submissions if any
    let childBatches = [];
    try {
      childBatches = await BulkPassParentRequest.getChildBatches(requestId);
    } catch (error) {
      console.error("[ADMIN-PUBLIC-REQUEST] Error fetching child batches:", error);
      // Continue without child batches
    }

    console.log(`[ADMIN-PUBLIC-REQUEST] Request found: ${parentRequest.tracking_number}, status: ${parentRequest.status}`);

    // Return complete request details
    return res.status(200).json({
      success: true,
      request: {
        id: parentRequest.id,
        tracking_number: parentRequest.tracking_number,
        shared_token: parentRequest.shared_token,
        company_name: parentRequest.company_name,
        applicant_email: parentRequest.applicant_email,
        applicant_mobile: parentRequest.applicant_mobile,
        visitor_type: parentRequest.visitor_type,
        no_of_persons: parentRequest.no_of_persons,
        no_of_vehicles: parentRequest.no_of_vehicles,
        payment_mode: parentRequest.payment_mode,
        purpose: parentRequest.purpose,
        validity_from: parentRequest.validity_from,
        validity_upto: parentRequest.validity_upto,
        work_order_required: parentRequest.work_order_required,
        ref_doc_no: parentRequest.ref_doc_no,
        remarks: parentRequest.remarks,
        token_active: parentRequest.token_active,
        approved_time_from: parentRequest.approved_time_from,
        approved_time_upto: parentRequest.approved_time_upto,
        status: parentRequest.status,
        rejection_reason: parentRequest.rejection_reason,
        created_at: parentRequest.created_at,
        approved_at: parentRequest.approved_at,
        approved_by_user_id: parentRequest.approved_by_user_id,
        approved_by_user: approvedByUser,
        rejected_at: parentRequest.rejected_at,
        rejected_by_user_id: parentRequest.rejected_by_user_id,
        rejected_by_user: rejectedByUser,
        child_batches: childBatches
      }
    });

  } catch (error) {
    console.error("[ADMIN-PUBLIC-REQUEST] getRequestDetail error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching request details"
    });
  }
};

/**
 * Approve Public Request
 * 
 * Approves a pending public bulk pass request, generates a secure upload token,
 * enables multiple submissions capability, and sends approval email with upload link.
 * 
 * Request Body:
 * - validityFrom: Date (required) - Start date of submission window
 * - validityUpto: Date (required) - End date of submission window
 * - remarks: String (optional) - Admin remarks/notes
 * 
 * Business Logic:
 * 1. Validate request ID and body fields
 * 2. Validate that validityFrom < validityUpto
 * 3. Retrieve parent request by ID
 * 4. Check current status is PENDING_ADMIN_APPROVAL
 * 5. Update status to ACTIVE
 * 6. Generate unique shared_token (encrypted JWT)
 * 7. Set approved_time_from and approved_time_upto from request body
 * 8. Set token_active to true
 * 9. Set approved_by_user_id to current admin user ID
 * 10. Set approved_at to current timestamp
 * 11. Generate upload link: ${FRONTEND_URL}/bulk-upload/${shared_token}
 * 12. Send approval email to applicant with upload link via email service
 * 13. Return success response with shared_token and upload_link
 * 
 * Authentication: Required (JWT with GENERAL_ADMIN role)
 * 
 * Requirements: 25.4, 25.5, 25.6
 * 
 * @route POST /api/bulk-pass/admin/public-requests/:id/approve
 * @access Private (GENERAL_ADMIN role)
 */
exports.approveRequest = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { validityFrom, validityUpto, remarks } = req.body;
    const adminUserId = req.user?.id || req.user?.userId;

    console.log(`[ADMIN-PUBLIC-REQUEST] Approve request ${requestId} by admin user: ${adminUserId}`);

    // Validate request ID
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID"
      });
    }

    // Validate request body: validityFrom and validityUpto are required
    if (!validityFrom || !validityUpto) {
      return res.status(400).json({
        success: false,
        message: "validityFrom and validityUpto are required"
      });
    }

    // Validate date formats
    const fromDate = new Date(validityFrom);
    const uptoDate = new Date(validityUpto);

    if (isNaN(fromDate.getTime()) || isNaN(uptoDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format for validityFrom or validityUpto"
      });
    }

    // Validate that validityFrom < validityUpto
    if (fromDate >= uptoDate) {
      return res.status(400).json({
        success: false,
        message: "validityFrom must be before validityUpto"
      });
    }

    // Retrieve parent request by ID
    const parentRequest = await BulkPassParentRequest.getById(requestId);

    // Handle 404 Not Found if request doesn't exist
    if (!parentRequest) {
      console.log(`[ADMIN-PUBLIC-REQUEST] Request not found: ${requestId}`);
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    // Check current status is PENDING_ADMIN_APPROVAL
    if (parentRequest.status !== "PENDING_ADMIN_APPROVAL") {
      console.log(`[ADMIN-PUBLIC-REQUEST] Invalid status for approval: ${parentRequest.status}`);
      return res.status(409).json({
        success: false,
        message: `Request has already been processed (current status: ${parentRequest.status})`
      });
    }

    console.log(`[ADMIN-PUBLIC-REQUEST] Generating upload token for parent request ${requestId}`);

    // Generate unique shared_token (encrypted JWT)
    // The token contains the parent request ID and source type
    const jwtToken = generateUploadToken(requestId, "PUBLIC_WEBSITE", {
      expiresIn: "365d" // Token valid for 1 year (actual validity controlled by approved_time_upto)
    });

    const shared_token = encryptToken(jwtToken);

    console.log(`[ADMIN-PUBLIC-REQUEST] Token generated and encrypted for request ${requestId}`);

    // Update status to ACTIVE and set approval fields
    const updateData = {
      status: "ACTIVE",
      token_active: true,
      approved_time_from: validityFrom,
      approved_time_upto: validityUpto,
      approved_by_user_id: adminUserId,
      approved_at: new Date(),
      shared_token: shared_token
    };

    // Add remarks if provided
    if (remarks) {
      updateData.remarks = remarks;
    }

    // Update parent request in database
    const updatedRequest = await BulkPassParentRequest.update(requestId, updateData);

    if (!updatedRequest) {
      console.error(`[ADMIN-PUBLIC-REQUEST] Failed to update request ${requestId}`);
      return res.status(500).json({
        success: false,
        message: "Failed to approve request"
      });
    }

    console.log(`[ADMIN-PUBLIC-REQUEST] Request ${requestId} approved successfully`);

    // Generate upload link: ${FRONTEND_URL}/bulk-upload/${shared_token}
    const FRONTEND_URL = process.env.FRONTEND_BASE_URL || "http://localhost:3000";
    const uploadLink = `${FRONTEND_URL}/bulk-upload/${shared_token}`;

    console.log(`[ADMIN-PUBLIC-REQUEST] Upload link generated: ${uploadLink.substring(0, 50)}...`);

    // Send approval email to applicant with upload link via email service
    const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL;

    if (EMAIL_SERVICE_URL) {
      try {
        await axios.post(
          `${EMAIL_SERVICE_URL}/api/email/sendPublicRequestApproved`,
          {
            email: parentRequest.applicant_email,
            companyName: parentRequest.company_name,
            trackingNumber: parentRequest.tracking_number,
            uploadLink: uploadLink,
            validityFrom: validityFrom,
            validityUpto: validityUpto,
            remarks: remarks || ""
          },
          {
            headers: { "x-service-name": "USER-SERVICE" },
            timeout: 8000
          }
        );

        console.log(`[ADMIN-PUBLIC-REQUEST] Approval email sent to ${parentRequest.applicant_email}`);
      } catch (emailError) {
        console.error("[ADMIN-PUBLIC-REQUEST] Failed to send approval email:", emailError.message);
        // Continue - email failure should not block the approval
      }
    } else {
      console.warn("[ADMIN-PUBLIC-REQUEST] EMAIL_SERVICE_URL not configured, skipping email");
    }

    // Return success response with shared_token and upload_link
    return res.status(200).json({
      success: true,
      message: "Request approved successfully",
      shared_token: shared_token,
      upload_link: uploadLink,
      request: {
        id: updatedRequest.id,
        tracking_number: updatedRequest.tracking_number,
        status: updatedRequest.status,
        approved_at: updatedRequest.approved_at,
        approved_time_from: updatedRequest.approved_time_from,
        approved_time_upto: updatedRequest.approved_time_upto
      }
    });

  } catch (error) {
    console.error("[ADMIN-PUBLIC-REQUEST] approveRequest error:", error);

    // Handle specific errors
    if (error.message && error.message.includes("ENCRYPTION_KEY")) {
      return res.status(500).json({
        success: false,
        message: "Token encryption configuration error",
        errorDetails: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: `Failed to approve request: ${error.message}`,
      errorDetails: error.message
    });
  }
};

/**
 * Reject Public Request
 * 
 * Rejects a pending public bulk pass request with a specified reason
 * and sends rejection notification email to the applicant.
 * 
 * Request Body:
 * - rejectionReason: String (required, 10-1000 characters) - Reason for rejection
 * 
 * Business Logic:
 * 1. Validate request ID
 * 2. Validate request body: rejectionReason (required, 10-1000 characters)
 * 3. Retrieve parent request by ID
 * 4. Check current status is PENDING_ADMIN_APPROVAL
 * 5. Update status to REJECTED_BY_ADMIN
 * 6. Set rejection_reason from request body
 * 7. Set rejected_by_user_id to current admin user ID
 * 8. Set rejected_at to current timestamp
 * 9. Send rejection email to applicant via email service
 * 10. Return success response
 * 
 * Authentication: Required (JWT with GENERAL_ADMIN role)
 * 
 * Requirements: 26.1, 26.2, 26.3, 26.4, 26.5
 * 
 * @route POST /api/bulk-pass/admin/public-requests/:id/reject
 * @access Private (GENERAL_ADMIN role)
 */
exports.rejectRequest = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { rejectionReason } = req.body;
    const adminUserId = req.user?.id || req.user?.userId;

    console.log(`[ADMIN-PUBLIC-REQUEST] Reject request ${requestId} by admin user: ${adminUserId}`);

    // Validate request ID
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID"
      });
    }

    // Validate request body: rejectionReason is required
    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "rejectionReason is required"
      });
    }

    // Validate rejectionReason length (10-1000 characters)
    if (typeof rejectionReason !== "string" || rejectionReason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "rejectionReason must be at least 10 characters"
      });
    }

    if (rejectionReason.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "rejectionReason must not exceed 1000 characters"
      });
    }

    // Retrieve parent request by ID
    const parentRequest = await BulkPassParentRequest.getById(requestId);

    // Handle 404 Not Found if request doesn't exist
    if (!parentRequest) {
      console.log(`[ADMIN-PUBLIC-REQUEST] Request not found: ${requestId}`);
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    // Check current status is PENDING_ADMIN_APPROVAL
    if (parentRequest.status !== "PENDING_ADMIN_APPROVAL") {
      console.log(`[ADMIN-PUBLIC-REQUEST] Invalid status for rejection: ${parentRequest.status}`);
      return res.status(409).json({
        success: false,
        message: `Request has already been processed (current status: ${parentRequest.status})`
      });
    }

    console.log(`[ADMIN-PUBLIC-REQUEST] Rejecting request ${requestId} with reason: ${rejectionReason.substring(0, 50)}...`);

    // Update status to REJECTED_BY_ADMIN and set rejection fields
    const updateData = {
      status: "REJECTED_BY_ADMIN",
      rejection_reason: rejectionReason.trim(),
      rejected_by_user_id: adminUserId,
      rejected_at: new Date(),
      token_active: false // Ensure token is deactivated
    };

    // Update parent request in database
    const updatedRequest = await BulkPassParentRequest.update(requestId, updateData);

    if (!updatedRequest) {
      console.error(`[ADMIN-PUBLIC-REQUEST] Failed to update request ${requestId}`);
      return res.status(500).json({
        success: false,
        message: "Failed to reject request"
      });
    }

    console.log(`[ADMIN-PUBLIC-REQUEST] Request ${requestId} rejected successfully`);

    // Send rejection email to applicant via email service
    const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL;

    if (EMAIL_SERVICE_URL) {
      try {
        await axios.post(
          `${EMAIL_SERVICE_URL}/api/email/sendRejectionNotification`,
          {
            email: parentRequest.applicant_email,
            applicantEmail: parentRequest.applicant_email,
            companyName: parentRequest.company_name,
            trackingNumber: parentRequest.tracking_number,
            rejectionReason: rejectionReason.trim(),
            submissionDate: parentRequest.created_at
          },
          {
            headers: { "x-service-name": "USER-SERVICE" },
            timeout: 8000
          }
        );

        console.log(`[ADMIN-PUBLIC-REQUEST] Rejection email sent to ${parentRequest.applicant_email}`);
      } catch (emailError) {
        console.error("[ADMIN-PUBLIC-REQUEST] Failed to send rejection email:", emailError.message);
        // Continue - email failure should not block the rejection
      }
    } else {
      console.warn("[ADMIN-PUBLIC-REQUEST] EMAIL_SERVICE_URL not configured, skipping email");
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Request rejected successfully",
      request: {
        id: updatedRequest.id,
        tracking_number: updatedRequest.tracking_number,
        status: updatedRequest.status,
        rejected_at: updatedRequest.rejected_at,
        rejection_reason: updatedRequest.rejection_reason
      }
    });

  } catch (error) {
    console.error("[ADMIN-PUBLIC-REQUEST] rejectRequest error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error while rejecting request"
    });
  }
};
