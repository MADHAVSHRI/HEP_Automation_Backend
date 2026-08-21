/**
 * Unit tests for Admin Public Request Controller
 * 
 * Tests the getPendingRequests endpoint for fetching and filtering
 * public bulk pass requests with pagination.
 * 
 * Requirements: 25.1-25.3
 */

const adminPublicRequestController = require("../src/controllers/adminPublicRequestController");
const BulkPassParentRequest = require("../src/models/BulkPassParentRequest");
const { pool } = require("../src/dbconfig/db");
const axios = require("axios");
const { generateUploadToken, encryptToken } = require("../src/utils/tokenUtils");

// Mock the BulkPassParentRequest model
jest.mock("../src/models/BulkPassParentRequest");

// Mock the database pool
jest.mock("../src/dbconfig/db", () => ({
  pool: {
    query: jest.fn()
  }
}));

// Mock axios
jest.mock("axios");

// Mock tokenUtils
jest.mock("../src/utils/tokenUtils", () => ({
  generateUploadToken: jest.fn(),
  encryptToken: jest.fn()
}));

describe("Admin Public Request Controller", () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock request object
    req = {
      user: { id: 1, role: "GENERAL_ADMIN" },
      query: {}
    };

    // Mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
  });

  describe("getPendingRequests", () => {
    it("should return paginated requests with default parameters", async () => {
      // Arrange
      const mockRequests = [
        {
          id: 1,
          tracking_number: "TEMP-1234567890-ABC123",
          company_name: "Test Company 1",
          applicant_email: "test1@example.com",
          applicant_mobile: "9876543210",
          no_of_persons: 10,
          no_of_vehicles: 2,
          validity_from: "2026-01-01",
          validity_upto: "2026-12-31",
          purpose: "Testing",
          status: "PENDING_ADMIN_APPROVAL",
          created_at: "2026-01-15T10:00:00Z",
          approved_at: null,
          rejected_at: null,
          rejection_reason: null
        },
        {
          id: 2,
          tracking_number: "TEMP-1234567891-DEF456",
          company_name: "Test Company 2",
          applicant_email: "test2@example.com",
          applicant_mobile: "9876543211",
          no_of_persons: 15,
          no_of_vehicles: 3,
          validity_from: "2026-02-01",
          validity_upto: "2026-12-31",
          purpose: "Another test",
          status: "PENDING_ADMIN_APPROVAL",
          created_at: "2026-01-16T11:00:00Z",
          approved_at: null,
          rejected_at: null,
          rejection_reason: null
        }
      ];

      BulkPassParentRequest.list.mockResolvedValue(mockRequests);

      // Act
      await adminPublicRequestController.getPendingRequests(req, res);

      // Assert
      expect(BulkPassParentRequest.list).toHaveBeenCalledWith({
        status: "PENDING_ADMIN_APPROVAL"
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        requests: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            tracking_number: "TEMP-1234567890-ABC123",
            company_name: "Test Company 1"
          }),
          expect.objectContaining({
            id: 2,
            tracking_number: "TEMP-1234567891-DEF456",
            company_name: "Test Company 2"
          })
        ]),
        pagination: {
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1
        }
      });
    });

    it("should filter by status when provided", async () => {
      // Arrange
      req.query.status = "ACTIVE";

      const mockRequests = [
        {
          id: 3,
          tracking_number: "TEMP-1234567892-GHI789",
          company_name: "Active Company",
          applicant_email: "active@example.com",
          applicant_mobile: "9876543212",
          no_of_persons: 20,
          no_of_vehicles: 5,
          validity_from: "2026-01-01",
          validity_upto: "2026-12-31",
          purpose: "Active request",
          status: "ACTIVE",
          created_at: "2026-01-10T09:00:00Z",
          approved_at: "2026-01-11T10:00:00Z",
          rejected_at: null,
          rejection_reason: null
        }
      ];

      BulkPassParentRequest.list.mockResolvedValue(mockRequests);

      // Act
      await adminPublicRequestController.getPendingRequests(req, res);

      // Assert
      expect(BulkPassParentRequest.list).toHaveBeenCalledWith({
        status: "ACTIVE"
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        requests: expect.arrayContaining([
          expect.objectContaining({
            id: 3,
            status: "ACTIVE"
          })
        ]),
        pagination: expect.objectContaining({
          total: 1
        })
      });
    });

    it("should apply pagination correctly", async () => {
      // Arrange
      req.query.page = "2";
      req.query.limit = "1";

      const mockRequests = [
        { id: 1, tracking_number: "TEMP-1", company_name: "Company 1", applicant_email: "test1@example.com", applicant_mobile: "9876543210", no_of_persons: 10, no_of_vehicles: 2, validity_from: "2026-01-01", validity_upto: "2026-12-31", purpose: "Test 1", status: "PENDING_ADMIN_APPROVAL", created_at: "2026-01-15T10:00:00Z", approved_at: null, rejected_at: null, rejection_reason: null },
        { id: 2, tracking_number: "TEMP-2", company_name: "Company 2", applicant_email: "test2@example.com", applicant_mobile: "9876543211", no_of_persons: 15, no_of_vehicles: 3, validity_from: "2026-02-01", validity_upto: "2026-12-31", purpose: "Test 2", status: "PENDING_ADMIN_APPROVAL", created_at: "2026-01-16T11:00:00Z", approved_at: null, rejected_at: null, rejection_reason: null },
        { id: 3, tracking_number: "TEMP-3", company_name: "Company 3", applicant_email: "test3@example.com", applicant_mobile: "9876543212", no_of_persons: 20, no_of_vehicles: 4, validity_from: "2026-03-01", validity_upto: "2026-12-31", purpose: "Test 3", status: "PENDING_ADMIN_APPROVAL", created_at: "2026-01-17T12:00:00Z", approved_at: null, rejected_at: null, rejection_reason: null }
      ];

      BulkPassParentRequest.list.mockResolvedValue(mockRequests);

      // Act
      await adminPublicRequestController.getPendingRequests(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        requests: [
          expect.objectContaining({ id: 2, tracking_number: "TEMP-2" })
        ],
        pagination: {
          total: 3,
          page: 2,
          limit: 1,
          totalPages: 3
        }
      });
    });

    it("should handle search parameter", async () => {
      // Arrange
      req.query.search = "Company 1";

      const mockRequests = [
        { id: 1, tracking_number: "TEMP-1", company_name: "Company 1", applicant_email: "test1@example.com", applicant_mobile: "9876543210", no_of_persons: 10, no_of_vehicles: 2, validity_from: "2026-01-01", validity_upto: "2026-12-31", purpose: "Test", status: "PENDING_ADMIN_APPROVAL", created_at: "2026-01-15T10:00:00Z", approved_at: null, rejected_at: null, rejection_reason: null }
      ];

      BulkPassParentRequest.list.mockResolvedValue(mockRequests);

      // Act
      await adminPublicRequestController.getPendingRequests(req, res);

      // Assert
      expect(BulkPassParentRequest.list).toHaveBeenCalledWith({
        status: "PENDING_ADMIN_APPROVAL",
        search: "Company 1"
      });
    });

    it("should return 400 for invalid page parameter", async () => {
      // Arrange
      req.query.page = "0";

      // Act
      await adminPublicRequestController.getPendingRequests(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Page number must be at least 1"
      });
    });

    it("should return 400 for invalid limit parameter", async () => {
      // Arrange
      req.query.limit = "200";

      // Act
      await adminPublicRequestController.getPendingRequests(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Limit must be between 1 and 100"
      });
    });

    it("should return 400 for invalid status parameter", async () => {
      // Arrange
      req.query.status = "INVALID_STATUS";

      // Act
      await adminPublicRequestController.getPendingRequests(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining("Invalid status")
      });
    });

    it("should handle empty results gracefully", async () => {
      // Arrange
      BulkPassParentRequest.list.mockResolvedValue([]);

      // Act
      await adminPublicRequestController.getPendingRequests(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        requests: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0
        }
      });
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      BulkPassParentRequest.list.mockRejectedValue(new Error("Database connection failed"));

      // Act
      await adminPublicRequestController.getPendingRequests(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error while fetching requests"
      });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("getRequestDetail", () => {
    beforeEach(() => {
      req = {
        user: { id: 1, role: "GENERAL_ADMIN" },
        params: { id: "123" }
      };
    });

    it("should return complete request details with user associations", async () => {
      // Arrange
      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        shared_token: "encrypted_token_here",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        applicant_mobile: "9876543210",
        visitor_type: "VISITOR",
        no_of_persons: 10,
        no_of_vehicles: 2,
        payment_mode: "ONLINE",
        purpose: "Business meeting",
        validity_from: "2026-01-01",
        validity_upto: "2026-12-31",
        work_order_required: false,
        ref_doc_no: null,
        remarks: "Test remarks",
        token_active: true,
        approved_time_from: "2026-01-01T00:00:00Z",
        approved_time_upto: "2026-12-31T23:59:59Z",
        status: "ACTIVE",
        rejection_reason: null,
        created_at: "2026-01-15T10:00:00Z",
        approved_at: "2026-01-16T09:00:00Z",
        approved_by_user_id: 5,
        rejected_at: null,
        rejected_by_user_id: null
      };

      const mockApprovedByUser = {
        rows: [{
          id: 5,
          userName: "Admin User",
          email: "admin@example.com"
        }]
      };

      const mockChildBatches = [
        {
          id: 1,
          refNo: "BP/2026/00001",
          submissionNumber: 1,
          status: "UNDER_REVIEW",
          noOfPersons: 10,
          noOfVehicles: 2,
          createdAt: "2026-01-17T10:00:00Z",
          submittedPersonsCount: 10,
          submittedVehiclesCount: 2
        }
      ];

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      pool.query.mockResolvedValue(mockApprovedByUser);
      BulkPassParentRequest.getChildBatches.mockResolvedValue(mockChildBatches);

      // Act
      await adminPublicRequestController.getRequestDetail(req, res);

      // Assert
      expect(BulkPassParentRequest.getById).toHaveBeenCalledWith(123);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id, \"userName\", email FROM users WHERE id = $1"),
        [5]
      );
      expect(BulkPassParentRequest.getChildBatches).toHaveBeenCalledWith(123);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        request: expect.objectContaining({
          id: 123,
          tracking_number: "TEMP-1234567890-ABC123",
          company_name: "Test Company",
          status: "ACTIVE",
          approved_by_user: {
            id: 5,
            userName: "Admin User",
            email: "admin@example.com"
          },
          rejected_by_user: null,
          child_batches: mockChildBatches
        })
      });
    });

    it("should return request details without user associations when not available", async () => {
      // Arrange
      req.params.id = "124"; // Update request params
      const mockRequest = {
        id: 124,
        tracking_number: "TEMP-1234567891-DEF456",
        shared_token: "encrypted_token_here",
        company_name: "Test Company 2",
        applicant_email: "test2@example.com",
        applicant_mobile: "9876543211",
        visitor_type: "VISITOR",
        no_of_persons: 15,
        no_of_vehicles: 3,
        payment_mode: "CASH",
        purpose: "Site visit",
        validity_from: null,
        validity_upto: "2026-12-31",
        work_order_required: true,
        ref_doc_no: "WO-2026-001",
        remarks: null,
        token_active: false,
        approved_time_from: null,
        approved_time_upto: null,
        status: "PENDING_ADMIN_APPROVAL",
        rejection_reason: null,
        created_at: "2026-01-20T10:00:00Z",
        approved_at: null,
        approved_by_user_id: null,
        rejected_at: null,
        rejected_by_user_id: null
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      BulkPassParentRequest.getChildBatches.mockResolvedValue([]);

      // Act
      await adminPublicRequestController.getRequestDetail(req, res);

      // Assert
      expect(BulkPassParentRequest.getById).toHaveBeenCalledWith(124);
      expect(pool.query).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        request: expect.objectContaining({
          id: 124,
          status: "PENDING_ADMIN_APPROVAL",
          approved_by_user: null,
          rejected_by_user: null,
          child_batches: []
        })
      });
    });

    it("should return request with rejected_by user when rejected", async () => {
      // Arrange
      req.params.id = "125"; // Update request params
      const mockRequest = {
        id: 125,
        tracking_number: "TEMP-1234567892-GHI789",
        shared_token: "encrypted_token_here",
        company_name: "Rejected Company",
        applicant_email: "rejected@example.com",
        applicant_mobile: "9876543212",
        visitor_type: "CONTRACTOR",
        no_of_persons: 5,
        no_of_vehicles: 1,
        payment_mode: "ONLINE",
        purpose: "Maintenance work",
        validity_from: null,
        validity_upto: "2026-12-31",
        work_order_required: false,
        ref_doc_no: null,
        remarks: null,
        token_active: false,
        approved_time_from: null,
        approved_time_upto: null,
        status: "REJECTED_BY_ADMIN",
        rejection_reason: "Insufficient documentation",
        created_at: "2026-01-18T10:00:00Z",
        approved_at: null,
        approved_by_user_id: null,
        rejected_at: "2026-01-19T14:00:00Z",
        rejected_by_user_id: 6
      };

      const mockRejectedByUser = {
        rows: [{
          id: 6,
          userName: "Admin User 2",
          email: "admin2@example.com"
        }]
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      pool.query.mockResolvedValue(mockRejectedByUser);
      BulkPassParentRequest.getChildBatches.mockResolvedValue([]);

      // Act
      await adminPublicRequestController.getRequestDetail(req, res);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id, \"userName\", email FROM users WHERE id = $1"),
        [6]
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        request: expect.objectContaining({
          id: 125,
          status: "REJECTED_BY_ADMIN",
          rejection_reason: "Insufficient documentation",
          approved_by_user: null,
          rejected_by_user: {
            id: 6,
            userName: "Admin User 2",
            email: "admin2@example.com"
          }
        })
      });
    });

    it("should return 404 when request not found", async () => {
      // Arrange
      BulkPassParentRequest.getById.mockResolvedValue(null);

      // Act
      await adminPublicRequestController.getRequestDetail(req, res);

      // Assert
      expect(BulkPassParentRequest.getById).toHaveBeenCalledWith(123);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Request not found"
      });
    });

    it("should return 400 for invalid request ID", async () => {
      // Arrange
      req.params.id = "invalid";

      // Act
      await adminPublicRequestController.getRequestDetail(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid request ID"
      });
    });

    it("should handle user fetch errors gracefully", async () => {
      // Arrange
      req.params.id = "126"; // Update request params
      const mockRequest = {
        id: 126,
        tracking_number: "TEMP-1234567893-JKL012",
        shared_token: "encrypted_token_here",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        applicant_mobile: "9876543210",
        visitor_type: "VISITOR",
        no_of_persons: 10,
        no_of_vehicles: 2,
        payment_mode: "ONLINE",
        purpose: "Testing",
        validity_from: "2026-01-01",
        validity_upto: "2026-12-31",
        work_order_required: false,
        ref_doc_no: null,
        remarks: null,
        token_active: true,
        approved_time_from: "2026-01-01T00:00:00Z",
        approved_time_upto: "2026-12-31T23:59:59Z",
        status: "ACTIVE",
        rejection_reason: null,
        created_at: "2026-01-15T10:00:00Z",
        approved_at: "2026-01-16T09:00:00Z",
        approved_by_user_id: 5,
        rejected_at: null,
        rejected_by_user_id: null
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      pool.query.mockRejectedValue(new Error("Database error"));
      BulkPassParentRequest.getChildBatches.mockResolvedValue([]);

      // Act
      await adminPublicRequestController.getRequestDetail(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        request: expect.objectContaining({
          id: 126,
          approved_by_user: null,
          rejected_by_user: null
        })
      });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching approved_by user"),
        expect.any(Error)
      );
    });

    it("should handle child batches fetch errors gracefully", async () => {
      // Arrange
      req.params.id = "127"; // Update request params
      const mockRequest = {
        id: 127,
        tracking_number: "TEMP-1234567894-MNO345",
        shared_token: "encrypted_token_here",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        applicant_mobile: "9876543210",
        visitor_type: "VISITOR",
        no_of_persons: 10,
        no_of_vehicles: 2,
        payment_mode: "ONLINE",
        purpose: "Testing",
        validity_from: "2026-01-01",
        validity_upto: "2026-12-31",
        work_order_required: false,
        ref_doc_no: null,
        remarks: null,
        token_active: true,
        approved_time_from: "2026-01-01T00:00:00Z",
        approved_time_upto: "2026-12-31T23:59:59Z",
        status: "ACTIVE",
        rejection_reason: null,
        created_at: "2026-01-15T10:00:00Z",
        approved_at: "2026-01-16T09:00:00Z",
        approved_by_user_id: null,
        rejected_at: null,
        rejected_by_user_id: null
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      BulkPassParentRequest.getChildBatches.mockRejectedValue(new Error("Database error"));

      // Act
      await adminPublicRequestController.getRequestDetail(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        request: expect.objectContaining({
          id: 127,
          child_batches: []
        })
      });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching child batches"),
        expect.any(Error)
      );
    });

    it("should handle general errors", async () => {
      // Arrange
      BulkPassParentRequest.getById.mockRejectedValue(new Error("Database connection failed"));

      // Act
      await adminPublicRequestController.getRequestDetail(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error while fetching request details"
      });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("approveRequest", () => {
    beforeEach(() => {
      // Set up environment variables
      process.env.FRONTEND_BASE_URL = "http://localhost:3000";
      process.env.EMAIL_SERVICE_URL = "http://localhost:5002";

      req = {
        user: { id: 1, userId: 1, role: "GENERAL_ADMIN" },
        params: { id: "123" },
        body: {
          validityFrom: "2026-01-01",
          validityUpto: "2026-12-31",
          remarks: "Approved for testing"
        }
      };

      // Mock tokenUtils functions
      generateUploadToken.mockReturnValue("mock_jwt_token");
      encryptToken.mockReturnValue("mock_encrypted_token");

      // Mock axios.post
      axios.post.mockResolvedValue({ data: { success: true } });

      // Mock console.warn
      console.warn = jest.fn();
    });

    afterEach(() => {
      delete process.env.FRONTEND_BASE_URL;
      delete process.env.EMAIL_SERVICE_URL;
    });

    it("should successfully approve a pending request", async () => {
      // Arrange
      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        applicant_mobile: "9876543210",
        status: "PENDING_ADMIN_APPROVAL"
      };

      const mockUpdatedRequest = {
        ...mockRequest,
        status: "ACTIVE",
        token_active: true,
        approved_time_from: "2026-01-01",
        approved_time_upto: "2026-12-31",
        approved_by_user_id: 1,
        approved_at: new Date(),
        shared_token: "mock_encrypted_token"
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      BulkPassParentRequest.update.mockResolvedValue(mockUpdatedRequest);

      // Act
      await adminPublicRequestController.approveRequest(req, res);

      // Assert
      expect(BulkPassParentRequest.getById).toHaveBeenCalledWith(123);
      expect(generateUploadToken).toHaveBeenCalledWith(123, "PUBLIC_WEBSITE", {
        expiresIn: "365d"
      });
      expect(encryptToken).toHaveBeenCalledWith("mock_jwt_token");
      
      expect(BulkPassParentRequest.update).toHaveBeenCalledWith(123, expect.objectContaining({
        status: "ACTIVE",
        token_active: true,
        approved_time_from: "2026-01-01",
        approved_time_upto: "2026-12-31",
        approved_by_user_id: 1,
        shared_token: "mock_encrypted_token",
        remarks: "Approved for testing"
      }));

      expect(axios.post).toHaveBeenCalledWith(
        "http://localhost:5002/api/email/sendPublicRequestApproved",
        expect.objectContaining({
          email: "test@example.com",
          companyName: "Test Company",
          trackingNumber: "TEMP-1234567890-ABC123",
          uploadLink: "http://localhost:3000/bulk-upload/mock_encrypted_token",
          validityFrom: "2026-01-01",
          validityUpto: "2026-12-31",
          remarks: "Approved for testing"
        }),
        expect.objectContaining({
          headers: { "x-service-name": "USER-SERVICE" },
          timeout: 8000
        })
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Request approved successfully",
        shared_token: "mock_encrypted_token",
        upload_link: "http://localhost:3000/bulk-upload/mock_encrypted_token",
        request: expect.objectContaining({
          id: 123,
          tracking_number: "TEMP-1234567890-ABC123",
          status: "ACTIVE"
        })
      });
    });

    it("should return 400 for invalid request ID", async () => {
      // Arrange
      req.params.id = "invalid";

      // Act
      await adminPublicRequestController.approveRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid request ID"
      });
    });

    it("should return 400 when validityFrom is missing", async () => {
      // Arrange
      req.body.validityFrom = null;

      // Act
      await adminPublicRequestController.approveRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "validityFrom and validityUpto are required"
      });
    });

    it("should return 400 when validityUpto is missing", async () => {
      // Arrange
      req.body.validityUpto = null;

      // Act
      await adminPublicRequestController.approveRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "validityFrom and validityUpto are required"
      });
    });

    it("should return 400 for invalid date format", async () => {
      // Arrange
      req.body.validityFrom = "invalid-date";

      // Act
      await adminPublicRequestController.approveRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid date format for validityFrom or validityUpto"
      });
    });

    it("should return 400 when validityFrom >= validityUpto", async () => {
      // Arrange
      req.body.validityFrom = "2026-12-31";
      req.body.validityUpto = "2026-01-01";

      // Act
      await adminPublicRequestController.approveRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "validityFrom must be before validityUpto"
      });
    });

    it("should return 404 when request not found", async () => {
      // Arrange
      BulkPassParentRequest.getById.mockResolvedValue(null);

      // Act
      await adminPublicRequestController.approveRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Request not found"
      });
    });

    it("should return 409 when request is already processed", async () => {
      // Arrange
      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        status: "ACTIVE" // Already approved
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);

      // Act
      await adminPublicRequestController.approveRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Request has already been processed (current status: ACTIVE)"
      });
    });

    it("should handle email service failures gracefully", async () => {
      // Arrange
      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        status: "PENDING_ADMIN_APPROVAL"
      };

      const mockUpdatedRequest = {
        ...mockRequest,
        status: "ACTIVE",
        token_active: true,
        approved_at: new Date(),
        shared_token: "mock_encrypted_token"
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      BulkPassParentRequest.update.mockResolvedValue(mockUpdatedRequest);
      axios.post.mockRejectedValue(new Error("Email service unavailable"));

      // Act
      await adminPublicRequestController.approveRequest(req, res);

      // Assert - should still return success even if email fails
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Request approved successfully"
        })
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send approval email"),
        expect.any(String)
      );
    });

    it("should work when EMAIL_SERVICE_URL is not configured", async () => {
      // Arrange
      delete process.env.EMAIL_SERVICE_URL;

      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        status: "PENDING_ADMIN_APPROVAL"
      };

      const mockUpdatedRequest = {
        ...mockRequest,
        status: "ACTIVE",
        token_active: true,
        approved_at: new Date(),
        shared_token: "mock_encrypted_token"
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      BulkPassParentRequest.update.mockResolvedValue(mockUpdatedRequest);

      // Act
      await adminPublicRequestController.approveRequest(req, res);

      // Assert
      expect(axios.post).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("EMAIL_SERVICE_URL not configured")
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should return 500 when update fails", async () => {
      // Arrange
      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        status: "PENDING_ADMIN_APPROVAL"
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      BulkPassParentRequest.update.mockResolvedValue(null); // Update failed

      // Act
      await adminPublicRequestController.approveRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to approve request"
      });
    });

    it("should handle token encryption errors", async () => {
      // Arrange
      const mockRequest = {
        id: 123,
        status: "PENDING_ADMIN_APPROVAL"
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      encryptToken.mockImplementation(() => {
        throw new Error("ENCRYPTION_KEY environment variable is required");
      });

      // Act
      await adminPublicRequestController.approveRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Token encryption configuration error"
      });
    });

    it("should approve request without remarks", async () => {
      // Arrange
      req.body.remarks = undefined; // No remarks provided

      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        status: "PENDING_ADMIN_APPROVAL"
      };

      const mockUpdatedRequest = {
        ...mockRequest,
        status: "ACTIVE",
        token_active: true,
        approved_at: new Date(),
        shared_token: "mock_encrypted_token"
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      BulkPassParentRequest.update.mockResolvedValue(mockUpdatedRequest);

      // Act
      await adminPublicRequestController.approveRequest(req, res);

      // Assert
      expect(BulkPassParentRequest.update).toHaveBeenCalledWith(123, expect.not.objectContaining({
        remarks: expect.anything()
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("rejectRequest", () => {
    beforeEach(() => {
      // Set up environment variables
      process.env.EMAIL_SERVICE_URL = "http://localhost:5002";

      req = {
        user: { id: 1, userId: 1, role: "GENERAL_ADMIN" },
        params: { id: "123" },
        body: {
          rejectionReason: "Incomplete documentation. Please provide valid work order."
        }
      };

      // Mock axios.post
      axios.post.mockResolvedValue({ data: { success: true } });

      // Mock console.warn
      console.warn = jest.fn();
    });

    afterEach(() => {
      delete process.env.EMAIL_SERVICE_URL;
    });

    it("should successfully reject a pending request", async () => {
      // Arrange
      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        applicant_mobile: "9876543210",
        status: "PENDING_ADMIN_APPROVAL",
        created_at: "2026-01-20T10:00:00Z"
      };

      const mockUpdatedRequest = {
        ...mockRequest,
        status: "REJECTED_BY_ADMIN",
        rejection_reason: "Incomplete documentation. Please provide valid work order.",
        rejected_by_user_id: 1,
        rejected_at: new Date(),
        token_active: false
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      BulkPassParentRequest.update.mockResolvedValue(mockUpdatedRequest);

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(BulkPassParentRequest.getById).toHaveBeenCalledWith(123);
      
      expect(BulkPassParentRequest.update).toHaveBeenCalledWith(123, expect.objectContaining({
        status: "REJECTED_BY_ADMIN",
        rejection_reason: "Incomplete documentation. Please provide valid work order.",
        rejected_by_user_id: 1,
        token_active: false
      }));

      expect(axios.post).toHaveBeenCalledWith(
        "http://localhost:5002/api/email/sendRejectionNotification",
        expect.objectContaining({
          email: "test@example.com",
          applicantEmail: "test@example.com",
          companyName: "Test Company",
          trackingNumber: "TEMP-1234567890-ABC123",
          rejectionReason: "Incomplete documentation. Please provide valid work order.",
          submissionDate: "2026-01-20T10:00:00Z"
        }),
        expect.objectContaining({
          headers: { "x-service-name": "USER-SERVICE" },
          timeout: 8000
        })
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Request rejected successfully",
        request: expect.objectContaining({
          id: 123,
          tracking_number: "TEMP-1234567890-ABC123",
          status: "REJECTED_BY_ADMIN",
          rejection_reason: "Incomplete documentation. Please provide valid work order."
        })
      });
    });

    it("should return 400 for invalid request ID", async () => {
      // Arrange
      req.params.id = "invalid";

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid request ID"
      });
    });

    it("should return 400 when rejectionReason is missing", async () => {
      // Arrange
      req.body.rejectionReason = null;

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "rejectionReason is required"
      });
    });

    it("should return 400 when rejectionReason is too short", async () => {
      // Arrange
      req.body.rejectionReason = "Too short"; // 9 characters

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "rejectionReason must be at least 10 characters"
      });
    });

    it("should return 400 when rejectionReason is too long", async () => {
      // Arrange
      req.body.rejectionReason = "a".repeat(1001); // 1001 characters

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "rejectionReason must not exceed 1000 characters"
      });
    });

    it("should return 400 when rejectionReason is not a string", async () => {
      // Arrange
      req.body.rejectionReason = 12345; // Number instead of string

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "rejectionReason must be at least 10 characters"
      });
    });

    it("should trim whitespace from rejectionReason", async () => {
      // Arrange
      req.body.rejectionReason = "  Incomplete documentation with spaces  ";

      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        status: "PENDING_ADMIN_APPROVAL",
        created_at: "2026-01-20T10:00:00Z"
      };

      const mockUpdatedRequest = {
        ...mockRequest,
        status: "REJECTED_BY_ADMIN",
        rejection_reason: "Incomplete documentation with spaces",
        rejected_by_user_id: 1,
        rejected_at: new Date(),
        token_active: false
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      BulkPassParentRequest.update.mockResolvedValue(mockUpdatedRequest);

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(BulkPassParentRequest.update).toHaveBeenCalledWith(123, expect.objectContaining({
        rejection_reason: "Incomplete documentation with spaces"
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should return 404 when request not found", async () => {
      // Arrange
      BulkPassParentRequest.getById.mockResolvedValue(null);

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Request not found"
      });
    });

    it("should return 409 when request is already processed", async () => {
      // Arrange
      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        status: "ACTIVE" // Already approved
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Request has already been processed (current status: ACTIVE)"
      });
    });

    it("should return 409 when request is already rejected", async () => {
      // Arrange
      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        status: "REJECTED_BY_ADMIN" // Already rejected
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Request has already been processed (current status: REJECTED_BY_ADMIN)"
      });
    });

    it("should handle email service failures gracefully", async () => {
      // Arrange
      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        status: "PENDING_ADMIN_APPROVAL",
        created_at: "2026-01-20T10:00:00Z"
      };

      const mockUpdatedRequest = {
        ...mockRequest,
        status: "REJECTED_BY_ADMIN",
        rejection_reason: "Incomplete documentation. Please provide valid work order.",
        rejected_by_user_id: 1,
        rejected_at: new Date(),
        token_active: false
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      BulkPassParentRequest.update.mockResolvedValue(mockUpdatedRequest);
      axios.post.mockRejectedValue(new Error("Email service unavailable"));

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert - should still return success even if email fails
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Request rejected successfully"
        })
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send rejection email"),
        expect.any(String)
      );
    });

    it("should work when EMAIL_SERVICE_URL is not configured", async () => {
      // Arrange
      delete process.env.EMAIL_SERVICE_URL;

      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        status: "PENDING_ADMIN_APPROVAL"
      };

      const mockUpdatedRequest = {
        ...mockRequest,
        status: "REJECTED_BY_ADMIN",
        rejection_reason: "Incomplete documentation. Please provide valid work order.",
        rejected_by_user_id: 1,
        rejected_at: new Date(),
        token_active: false
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      BulkPassParentRequest.update.mockResolvedValue(mockUpdatedRequest);

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(axios.post).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("EMAIL_SERVICE_URL not configured")
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should return 500 when update fails", async () => {
      // Arrange
      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        status: "PENDING_ADMIN_APPROVAL"
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      BulkPassParentRequest.update.mockResolvedValue(null); // Update failed

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to reject request"
      });
    });

    it("should handle general errors", async () => {
      // Arrange
      BulkPassParentRequest.getById.mockRejectedValue(new Error("Database connection failed"));

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error while rejecting request"
      });
      expect(console.error).toHaveBeenCalled();
    });

    it("should use req.user.userId if req.user.id is not available", async () => {
      // Arrange
      req.user = { userId: 5, role: "GENERAL_ADMIN" }; // Only userId available

      const mockRequest = {
        id: 123,
        tracking_number: "TEMP-1234567890-ABC123",
        company_name: "Test Company",
        applicant_email: "test@example.com",
        status: "PENDING_ADMIN_APPROVAL",
        created_at: "2026-01-20T10:00:00Z"
      };

      const mockUpdatedRequest = {
        ...mockRequest,
        status: "REJECTED_BY_ADMIN",
        rejection_reason: "Incomplete documentation. Please provide valid work order.",
        rejected_by_user_id: 5,
        rejected_at: new Date(),
        token_active: false
      };

      BulkPassParentRequest.getById.mockResolvedValue(mockRequest);
      BulkPassParentRequest.update.mockResolvedValue(mockUpdatedRequest);

      // Act
      await adminPublicRequestController.rejectRequest(req, res);

      // Assert
      expect(BulkPassParentRequest.update).toHaveBeenCalledWith(123, expect.objectContaining({
        rejected_by_user_id: 5
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
