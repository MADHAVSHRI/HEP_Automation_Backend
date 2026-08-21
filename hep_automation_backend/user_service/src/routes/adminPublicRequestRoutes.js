/**
 * adminPublicRequestRoutes.js
 *
 * Admin API routes for managing public website-initiated bulk pass requests.
 * These routes handle General Administrator operations including:
 * - Viewing pending/filtered public requests with pagination
 * - Viewing detailed public request information
 * - Approving public requests (generates upload links for multiple submissions)
 * - Rejecting public requests with reasons
 *
 * All routes require JWT authentication middleware.
 * Approval and rejection routes additionally require GENERAL_ADMIN role authorization.
 *
 * Requirements: 25.1, 25.4, 26.1
 */

const express = require("express");
const router = express.Router();

// Middleware imports
const verifyToken = require("../middlewares/verifyToken");
const authorizeDepartment = require("../middlewares/authorizeDepartment");

// Controller imports
const adminPublicRequestController = require("../controllers/adminPublicRequestController");

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES (Authentication + Authorization Required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get Pending Public Requests
 * 
 * GET /api/bulk-pass/admin/public-requests
 * 
 * Retrieves a paginated list of public bulk pass requests with optional filtering.
 * General Administrators can view all public requests and filter by status.
 * 
 * Query Parameters:
 * - status: Filter by status (PENDING_ADMIN_APPROVAL, ACTIVE, REJECTED_BY_ADMIN, EXPIRED)
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20, max: 100)
 * - search: Search by company name, email, or tracking number
 * 
 * Authentication: Required (JWT)
 * Authorization: Required (GENERAL_ADMIN role)
 * 
 * Response (200 OK):
 * {
 *   "success": true,
 *   "requests": [
 *     {
 *       "id": 42,
 *       "tracking_number": "TEMP-1704067200-ABC123",
 *       "company_name": "ABC Productions Pvt Ltd",
 *       "applicant_email": "contact@abcproductions.com",
 *       "applicant_mobile": "9876543210",
 *       "no_of_persons": 25,
 *       "no_of_vehicles": 5,
 *       "validity_from": "2026-01-01",
 *       "validity_upto": "2026-12-31",
 *       "purpose": "Film shooting crew passes",
 *       "status": "PENDING_ADMIN_APPROVAL",
 *       "created_at": "2026-01-20T09:15:00Z",
 *       "approved_at": null,
 *       "rejected_at": null,
 *       "rejection_reason": null
 *     }
 *   ],
 *   "pagination": {
 *     "total": 15,
 *     "page": 1,
 *     "limit": 20,
 *     "totalPages": 1
 *   }
 * }
 * 
 * Error Responses:
 * - 400 Bad Request: Invalid query parameters
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User does not have GENERAL_ADMIN role
 * - 500 Internal Server Error: Database failure
 * 
 * Requirements: 25.1, 25.2, 25.3
 */
router.get(
  "/public-requests",
  verifyToken,
  authorizeDepartment("General Administration"),
  adminPublicRequestController.getPendingRequests
);

/**
 * Get Public Request Detail
 * 
 * GET /api/bulk-pass/admin/public-requests/:id
 * 
 * Retrieves complete details of a single public bulk pass request including:
 * - All request information (company details, pass requirements, purpose)
 * - Associated user data (approved_by, rejected_by)
 * - Child batch submissions (if the request has been approved and submissions made)
 * 
 * Path Parameters:
 * - id: Request ID (integer)
 * 
 * Authentication: Required (JWT)
 * Authorization: Not restricted (any authenticated user can view)
 * 
 * Response (200 OK):
 * {
 *   "success": true,
 *   "request": {
 *     "id": 42,
 *     "tracking_number": "TEMP-1704067200-ABC123",
 *     "shared_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "company_name": "ABC Productions Pvt Ltd",
 *     "applicant_email": "contact@abcproductions.com",
 *     "applicant_mobile": "9876543210",
 *     "visitor_type": "VENDOR",
 *     "no_of_persons": 25,
 *     "no_of_vehicles": 5,
 *     "payment_mode": "CASH",
 *     "purpose": "Film shooting crew passes",
 *     "validity_from": "2026-01-01",
 *     "validity_upto": "2026-12-31",
 *     "work_order_required": true,
 *     "ref_doc_no": "WO/2026/1234",
 *     "remarks": "Required for 3-month film production",
 *     "token_active": true,
 *     "approved_time_from": "2026-01-01T00:00:00Z",
 *     "approved_time_upto": "2026-12-31T23:59:59Z",
 *     "status": "ACTIVE",
 *     "rejection_reason": null,
 *     "created_at": "2026-01-20T09:15:00Z",
 *     "approved_at": "2026-01-21T14:30:00Z",
 *     "approved_by_user_id": 5,
 *     "approved_by_user": {
 *       "id": 5,
 *       "userName": "admin_user",
 *       "email": "admin@chenaiport.gov.in"
 *     },
 *     "rejected_at": null,
 *     "rejected_by_user_id": null,
 *     "rejected_by_user": null,
 *     "child_batches": [
 *       {
 *         "id": 100,
 *         "refNo": "BP/2026/00100",
 *         "submission_number": 1,
 *         "no_of_persons": 20,
 *         "no_of_vehicles": 3,
 *         "status": "COMPLETED",
 *         "created_at": "2026-02-01T10:00:00Z"
 *       }
 *     ]
 *   }
 * }
 * 
 * Error Responses:
 * - 400 Bad Request: Invalid request ID
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 404 Not Found: Request not found
 * - 500 Internal Server Error: Database failure
 * 
 * Requirements: 25.1
 */
router.get(
  "/public-requests/:id",
  verifyToken,
  adminPublicRequestController.getRequestDetail
);

/**
 * Approve Public Request
 * 
 * POST /api/bulk-pass/admin/public-requests/:id/approve
 * 
 * Approves a pending public bulk pass request, generates a secure upload token,
 * enables multiple submissions capability, and sends approval email with upload link.
 * 
 * Path Parameters:
 * - id: Request ID (integer)
 * 
 * Request Body:
 * {
 *   "validityFrom": "2026-02-01",        // Required - Start date of submission window
 *   "validityUpto": "2026-12-31",        // Required - End date of submission window
 *   "remarks": "Approved for production" // Optional - Admin remarks/notes
 * }
 * 
 * Authentication: Required (JWT)
 * Authorization: Required (GENERAL_ADMIN role)
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
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Request approved successfully",
 *   "shared_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "upload_link": "https://hep.chenaiport.gov.in/bulk-upload/eyJhbGci...",
 *   "request": {
 *     "id": 42,
 *     "tracking_number": "TEMP-1704067200-ABC123",
 *     "status": "ACTIVE",
 *     "approved_at": "2026-01-21T14:30:00Z",
 *     "approved_time_from": "2026-02-01T00:00:00Z",
 *     "approved_time_upto": "2026-12-31T23:59:59Z"
 *   }
 * }
 * 
 * Error Responses:
 * - 400 Bad Request: Invalid request ID, missing/invalid dates, validityFrom >= validityUpto
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User does not have GENERAL_ADMIN role
 * - 404 Not Found: Request not found
 * - 409 Conflict: Request already processed (not in PENDING_ADMIN_APPROVAL status)
 * - 500 Internal Server Error: Database failure, token encryption error, email service failure
 * 
 * Requirements: 25.4, 25.5, 25.6
 */
router.post(
  "/public-requests/:id/approve",
  verifyToken,
  authorizeDepartment("General Administration"),
  adminPublicRequestController.approveRequest
);

/**
 * Reject Public Request
 * 
 * POST /api/bulk-pass/admin/public-requests/:id/reject
 * 
 * Rejects a pending public bulk pass request with a specified reason
 * and sends rejection notification email to the applicant.
 * 
 * Path Parameters:
 * - id: Request ID (integer)
 * 
 * Request Body:
 * {
 *   "rejectionReason": "Incomplete documentation. Please provide valid work order." // Required, 10-1000 characters
 * }
 * 
 * Authentication: Required (JWT)
 * Authorization: Required (GENERAL_ADMIN role)
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
 * 9. Set token_active to false
 * 10. Send rejection email to applicant via email service
 * 11. Return success response
 * 
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Request rejected successfully",
 *   "request": {
 *     "id": 42,
 *     "tracking_number": "TEMP-1704067200-ABC123",
 *     "status": "REJECTED_BY_ADMIN",
 *     "rejected_at": "2026-01-21T14:30:00Z",
 *     "rejection_reason": "Incomplete documentation. Please provide valid work order."
 *   }
 * }
 * 
 * Error Responses:
 * - 400 Bad Request: Invalid request ID, missing/invalid rejectionReason, rejectionReason too short (<10 chars) or too long (>1000 chars)
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User does not have GENERAL_ADMIN role
 * - 404 Not Found: Request not found
 * - 409 Conflict: Request already processed (not in PENDING_ADMIN_APPROVAL status)
 * - 500 Internal Server Error: Database failure, email service failure
 * 
 * Requirements: 26.1, 26.2, 26.3, 26.4, 26.5
 */
router.post(
  "/public-requests/:id/reject",
  verifyToken,
  authorizeDepartment("General Administration"),
  adminPublicRequestController.rejectRequest
);

module.exports = router;
