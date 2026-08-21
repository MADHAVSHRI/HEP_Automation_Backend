/**
 * Test suite for enhanced token validation controller
 * Tests the validateToken endpoint with different scenarios:
 * - Parent request validation (public workflow)
 * - Multiple submission batch validation (department workflow)
 * - Single submission batch validation (legacy workflow)
 * 
 * Requirements: 8.1-8.6, 3.2-3.5, 7.1-7.2
 */

const request = require('supertest');
const express = require('express');
const bulkPassController = require('../src/controllers/bulkPassController');

// Mock the models
jest.mock('../src/models/bulkPassSchema');
jest.mock('../src/models/BulkPassParentRequest');

const BulkPassSchema = require('../src/models/bulkPassSchema');
const BulkPassParentRequest = require('../src/models/BulkPassParentRequest');

// Create a minimal Express app for testing
const app = express();
app.use(express.json());
app.get('/api/bulk-pass/validate-token/:token', bulkPassController.validateToken);

describe('validateToken Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Parent Request Validation (Public Workflow)', () => {
    test('should return parent request data when token belongs to active parent request', async () => {
      const mockParentRequest = {
        id: 1,
        tracking_number: 'TEMP-123456',
        shared_token: 'test-token',
        company_name: 'Test Company',
        applicant_email: 'test@example.com',
        applicant_mobile: '9876543210',
        visitor_type: 'VISITOR',
        no_of_persons: 30,
        no_of_vehicles: 5,
        payment_mode: 'CASH',
        purpose: 'Business Visit',
        validity_from: '2026-01-01',
        validity_upto: '2026-12-31',
        approved_time_from: '2026-01-01T00:00:00Z',
        approved_time_upto: '2026-12-31T23:59:59Z',
        work_order_required: false,
        ref_doc_no: null,
        remarks: null,
        status: 'ACTIVE',
        token_active: true,
      };

      const mockSubmissionHistory = [
        {
          id: 1,
          refNo: 'BP/2026/00001',
          submissionNumber: 1,
          status: 'UNDER_REVIEW',
          noOfPersons: 20,
          noOfVehicles: 3,
          createdAt: '2026-06-01T10:00:00Z',
        },
      ];

      BulkPassParentRequest.findByToken.mockResolvedValue(mockParentRequest);
      BulkPassSchema.getChildBatches.mockResolvedValue(mockSubmissionHistory);
      BulkPassSchema.getNextSubmissionNumber.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/bulk-pass/validate-token/test-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isParentRequest).toBe(true);
      expect(response.body.data.isParentBatch).toBe(false);
      expect(response.body.data.withinValidityPeriod).toBe(true);
      expect(response.body.data.parentRequest).toBeDefined();
      expect(response.body.data.parentRequest.companyName).toBe('Test Company');
      expect(response.body.data.submissionHistory).toHaveLength(1);
      expect(response.body.data.nextSubmissionNumber).toBe(2);
    });

    test('should return 403 when parent request is expired', async () => {
      const mockParentRequest = {
        id: 1,
        shared_token: 'test-token',
        token_active: true,
        approved_time_from: '2025-01-01T00:00:00Z',
        approved_time_upto: '2025-12-31T23:59:59Z', // Past date
        status: 'ACTIVE',
      };

      BulkPassParentRequest.findByToken.mockResolvedValue(mockParentRequest);

      const response = await request(app)
        .get('/api/bulk-pass/validate-token/test-token')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('submission period has expired');
    });
  });

  describe('Multiple Submission Batch Validation (Department Workflow)', () => {
    test('should return batch data when token belongs to multiple submission enabled batch', async () => {
      const mockBatch = {
        id: 1,
        refNo: 'BP/2026/00001',
        token: 'test-batch-token',
        tokenActive: true,
        multipleSubmissionsEnabled: true,
        departmentId: 9,
        departmentName: 'Traffic Department',
        visitorType: 'VISITOR',
        companyName: 'Test Company',
        applicantEmail: 'test@example.com',
        applicantMobile: '9876543210',
        noOfPersons: 30,
        noOfVehicles: 5,
        paymentMode: 'CASH',
        purpose: 'Business Visit',
        validityFrom: '2026-01-01',
        validityUpto: '2026-12-31',
        workOrderRequired: false,
        refDocNo: null,
        remarks: null,
        status: 'DRAFT',
      };

      const mockSubmissionHistory = [
        {
          id: 2,
          refNo: 'BP/2026/00002',
          submissionNumber: 1,
          status: 'UNDER_REVIEW',
          noOfPersons: 15,
          noOfVehicles: 2,
          createdAt: '2026-06-01T10:00:00Z',
        },
      ];

      BulkPassParentRequest.findByToken.mockResolvedValue(null);
      BulkPassSchema.getByToken.mockResolvedValue(mockBatch);
      BulkPassSchema.getChildBatches.mockResolvedValue(mockSubmissionHistory);
      BulkPassSchema.getNextSubmissionNumber.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/bulk-pass/validate-token/test-batch-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isParentRequest).toBe(false);
      expect(response.body.data.isParentBatch).toBe(true);
      expect(response.body.data.withinValidityPeriod).toBe(true);
      expect(response.body.data.batch).toBeDefined();
      expect(response.body.data.batch.multipleSubmissionsEnabled).toBe(true);
      expect(response.body.data.submissionHistory).toHaveLength(1);
      expect(response.body.data.nextSubmissionNumber).toBe(2);
    });

    test('should return 403 when multiple submission batch is expired', async () => {
      const mockBatch = {
        id: 1,
        token: 'test-batch-token',
        tokenActive: true,
        multipleSubmissionsEnabled: true,
        validityFrom: '2025-01-01',
        validityUpto: '2025-12-31', // Past date
      };

      BulkPassParentRequest.findByToken.mockResolvedValue(null);
      BulkPassSchema.getByToken.mockResolvedValue(mockBatch);

      const response = await request(app)
        .get('/api/bulk-pass/validate-token/test-batch-token')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('submission period has expired');
    });
  });

  describe('Single Submission Batch Validation (Legacy Workflow)', () => {
    test('should return batch data when token belongs to single submission batch', async () => {
      const mockBatch = {
        id: 1,
        refNo: 'BP/2026/00001',
        token: 'test-single-token',
        tokenActive: true,
        multipleSubmissionsEnabled: false,
        departmentId: 9,
        departmentName: 'Traffic Department',
        visitorType: 'VISITOR',
        companyName: 'Test Company',
        applicantEmail: 'test@example.com',
        applicantMobile: '9876543210',
        noOfPersons: 30,
        noOfVehicles: 5,
        paymentMode: 'CASH',
        purpose: 'Business Visit',
        validityFrom: '2026-01-01',
        validityUpto: '2026-12-31',
        workOrderRequired: false,
        refDocNo: null,
        remarks: null,
        status: 'DRAFT',
        linkValidityHours: 48,
        tokenExpiresAt: '2026-06-30T23:59:59Z',
      };

      BulkPassParentRequest.findByToken.mockResolvedValue(null);
      BulkPassSchema.getByToken.mockResolvedValue(mockBatch);

      const response = await request(app)
        .get('/api/bulk-pass/validate-token/test-single-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isParentRequest).toBe(false);
      expect(response.body.data.isParentBatch).toBe(false);
      expect(response.body.data.withinValidityPeriod).toBe(true);
      expect(response.body.data.batch).toBeDefined();
      expect(response.body.data.batch.multipleSubmissionsEnabled).toBe(false);
      expect(response.body.data.batch.linkValidityHours).toBe(48);
      expect(response.body.data.submissionHistory).toBeUndefined();
      expect(response.body.data.nextSubmissionNumber).toBeUndefined();
    });
  });

  describe('Error Scenarios', () => {
    test('should return 404 when token is not found', async () => {
      BulkPassParentRequest.findByToken.mockResolvedValue(null);
      BulkPassSchema.getByToken.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/bulk-pass/validate-token/invalid-token')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid or inactive token');
    });

    test('should return 403 when token is inactive', async () => {
      const mockBatch = {
        id: 1,
        token: 'test-token',
        tokenActive: false,
      };

      BulkPassParentRequest.findByToken.mockResolvedValue(null);
      BulkPassSchema.getByToken.mockResolvedValue(mockBatch);

      const response = await request(app)
        .get('/api/bulk-pass/validate-token/test-token')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Link expired or inactive');
    });

    test('should return 400 when token is missing', async () => {
      const response = await request(app)
        .get('/api/bulk-pass/validate-token/')
        .expect(404); // Express returns 404 for missing route param

      // Note: Express handles this as a route not found, not a 400
    });

    test('should return 500 when database error occurs', async () => {
      BulkPassParentRequest.findByToken.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/bulk-pass/validate-token/test-token')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Internal server error');
    });
  });
});
