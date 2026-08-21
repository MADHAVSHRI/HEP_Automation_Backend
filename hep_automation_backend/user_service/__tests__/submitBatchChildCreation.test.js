/**
 * Integration tests for child batch creation in submitBatch controller
 * 
 * Tests the new multiple submissions functionality where a parent batch
 * or parent request can have multiple child batch submissions.
 * 
 * Requirements: 9.1-9.11, 3.3, 15.1
 */

const request = require('supertest');
const express = require('express');
const bulkPassController = require('../src/controllers/bulkPassController');
const BulkPassSchema = require('../src/models/bulkPassSchema');
const BulkPassParentRequest = require('../src/models/BulkPassParentRequest');
const ReferenceNumber = require('../src/models/referenceNumberSchema');
const { pool } = require('../src/dbconfig/db');

// Mock dependencies
jest.mock('../src/models/bulkPassSchema');
jest.mock('../src/models/BulkPassParentRequest');
jest.mock('../src/models/referenceNumberSchema');
jest.mock('../src/dbconfig/db');
jest.mock('../src/services/excelParserService');
jest.mock('../src/services/photoCompressionService');
jest.mock('axios');

// Setup express app for testing
const app = express();
app.use(express.json());
app.post('/api/bulk-pass/public/:token/submit', bulkPassController.submitBatch);

describe('submitBatch - Child Batch Creation', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock pool.query for blacklist checks
    pool.query = jest.fn().mockResolvedValue({ rows: [] });
    
    // Mock pool.connect for reference number generation
    const mockClient = {
      release: jest.fn()
    };
    pool.connect = jest.fn().mockResolvedValue(mockClient);
    
    // Mock parseAndValidate to return valid rows
    const parseAndValidate = require('../src/services/excelParserService').parseAndValidate;
    parseAndValidate.mockResolvedValue({
      rows: [
        {
          fileName: 'test.xlsx',
          rowNumber: 1,
          name: 'John Doe',
          aadhaar: '123456789012',
          dob: '15/05/1990',
          mobile: '9876543210',
          address: 'Test Address',
          vehicleNumber: null,
          vehicleType: null,
          photoBuffer: Buffer.from('test'),
          validationStatus: 'valid',
          errorMessage: null
        }
      ],
      summary: { total: 1, valid: 1, invalid: 0 }
    });
    
    // Mock photo compression
    const compressPhotoBuffer = require('../src/services/photoCompressionService').compressPhotoBuffer;
    compressPhotoBuffer.mockResolvedValue(Buffer.from('compressed'));
  });
  
  describe('Public Request Parent (PUBLIC_WEBSITE)', () => {
    
    test('should create child batch for valid public request parent', async () => {
      const token = 'test-token-123';
      const mockParentRequest = {
        id: 1,
        company_name: 'ABC Productions',
        applicant_email: 'contact@abc.com',
        applicant_mobile: '9876543210',
        visitor_type: 'VENDOR',
        payment_mode: 'CASH',
        purpose: 'Film shooting',
        work_order_required: true,
        ref_doc_no: 'WO/2026/001',
        remarks: 'Test remarks',
        approved_time_from: new Date('2026-01-01').toISOString(),
        approved_time_upto: new Date('2099-12-31').toISOString(), // Future date
        status: 'ACTIVE',
        token_active: true
      };
      
      BulkPassParentRequest.findByToken.mockResolvedValue(mockParentRequest);
      BulkPassSchema.getNextSubmissionNumber.mockResolvedValue(1);
      ReferenceNumber.generateBulkPassReference.mockResolvedValue('BP/2026/00123');
      
      const mockChildBatch = {
        id: 100,
        refNo: 'BP/2026/00123',
        status: 'UNDER_REVIEW',
        submission_number: 1,
        parent_request_id: 1,
        request_source: 'PUBLIC_WEBSITE',
        applicantEmail: 'contact@abc.com',
        companyName: 'ABC Productions'
      };
      
      BulkPassSchema.createBatch.mockResolvedValue(mockChildBatch);
      BulkPassSchema.insertPersons.mockResolvedValue([]);
      BulkPassSchema.insertUpload.mockResolvedValue({});
      BulkPassSchema.logTransition.mockResolvedValue({});
      
      const response = await request(app)
        .post(`/api/bulk-pass/public/${token}/submit`)
        .send({
          filePaths: ['/tmp/test.xlsx'],
          fileNames: ['test.xlsx'],
          persons: [
            {
              aadhaarNo: '123456789012',
              fullName: 'John Doe',
              dob: '1990-05-15',
              mobile: '9876543210'
            }
          ],
          vehicles: []
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.childBatch).toBeDefined();
      expect(response.body.childBatch.refNo).toBe('BP/2026/00123');
      expect(response.body.childBatch.submissionNumber).toBe(1);
      expect(response.body.canSubmitMore).toBe(true);
      expect(response.body.nextSubmissionNumber).toBe(2);
      
      // Verify child batch was created with correct data
      expect(BulkPassSchema.createBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          refNo: 'BP/2026/00123',
          token: expect.any(String),
          status: 'UNDER_REVIEW',
          multipleSubmissionsEnabled: false,
          parent_request_id: 1,
          submission_number: 1,
          request_source: 'PUBLIC_WEBSITE',
          companyName: 'ABC Productions',
          applicantEmail: 'contact@abc.com'
        })
      );
    });
    
  });
  
  describe('Department Parent Batch (DEPARTMENT)', () => {
    
    test('should create child batch for valid department parent batch', async () => {
      const token = 'dept-token-456';
      const mockParentBatch = {
        id: 2,
        refNo: 'BP/2026/00050',
        companyName: 'XYZ School',
        applicantEmail: 'admin@xyz.edu',
        applicantMobile: '9988776655',
        visitorType: 'EDUCATIONAL_VISIT',
        paymentMode: 'ONLINE',
        purpose: 'School trip',
        workOrderRequired: false,
        refDocNo: null,
        remarks: 'Annual excursion',
        validityFrom: '2026-01-01',
        validityUpto: '2099-12-31', // Future date
        multipleSubmissionsEnabled: true,
        status: 'ACTIVE',
        tokenActive: true,
        departmentId: 9,
        departmentName: 'Traffic Department',
        createdByUserId: 5
      };
      
      BulkPassParentRequest.findByToken.mockResolvedValue(null);
      BulkPassSchema.getByToken.mockResolvedValue(mockParentBatch);
      BulkPassSchema.getNextSubmissionNumber.mockResolvedValue(3);
      ReferenceNumber.generateBulkPassReference.mockResolvedValue('BP/2026/00124');
      
      const mockChildBatch = {
        id: 101,
        refNo: 'BP/2026/00124',
        status: 'UNDER_REVIEW',
        submission_number: 3,
        parent_request_id: 2,
        request_source: 'DEPARTMENT',
        applicantEmail: 'admin@xyz.edu',
        companyName: 'XYZ School'
      };
      
      BulkPassSchema.createBatch.mockResolvedValue(mockChildBatch);
      BulkPassSchema.insertPersons.mockResolvedValue([]);
      BulkPassSchema.insertUpload.mockResolvedValue({});
      BulkPassSchema.logTransition.mockResolvedValue({});
      
      const response = await request(app)
        .post(`/api/bulk-pass/public/${token}/submit`)
        .send({
          filePaths: ['/tmp/test.xlsx'],
          fileNames: ['test.xlsx'],
          persons: [
            {
              aadhaarNo: '999888777666',
              fullName: 'Jane Smith',
              dob: '2000-03-20',
              mobile: '8765432109'
            }
          ],
          vehicles: []
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.childBatch.refNo).toBe('BP/2026/00124');
      expect(response.body.childBatch.submissionNumber).toBe(3);
      
      // Verify child batch was created with DEPARTMENT source
      expect(BulkPassSchema.createBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          request_source: 'DEPARTMENT',
          parent_request_id: 2,
          submission_number: 3
        })
      );
    });
    
  });
  
  describe('Validation Tests', () => {
    
    test('should reject submission with more than 30 persons', async () => {
      const persons = Array.from({ length: 31 }, (_, i) => ({
        aadhaarNo: `12345678${String(i).padStart(4, '0')}`,
        fullName: `Person ${i}`,
        dob: '1990-01-01',
        mobile: '9876543210'
      }));
      
      const response = await request(app)
        .post('/api/bulk-pass/public/test-token/submit')
        .send({
          filePaths: ['/tmp/test.xlsx'],
          persons,
          vehicles: []
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Maximum 30 persons');
    });
    
    test('should reject submission with more than 20 vehicles', async () => {
      const vehicles = Array.from({ length: 21 }, (_, i) => ({
        registrationNo: `TN01AB${String(i).padStart(4, '0')}`,
        vehicleType: 'CAR'
      }));
      
      const response = await request(app)
        .post('/api/bulk-pass/public/test-token/submit')
        .send({
          filePaths: ['/tmp/test.xlsx'],
          persons: [],
          vehicles
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Maximum 20 vehicles');
    });
    
    test('should reject submission when validity period expired', async () => {
      const mockParentRequest = {
        id: 1,
        company_name: 'Expired Company',
        approved_time_upto: new Date('2020-01-01').toISOString(), // Past date
        status: 'ACTIVE'
      };
      
      BulkPassParentRequest.findByToken.mockResolvedValue(mockParentRequest);
      
      const response = await request(app)
        .post('/api/bulk-pass/public/test-token/submit')
        .send({
          filePaths: ['/tmp/test.xlsx'],
          persons: [{ aadhaarNo: '123456789012' }],
          vehicles: []
        });
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('submission period has expired');
    });
    
    test('should reject submission when person is blacklisted', async () => {
      const mockParentRequest = {
        id: 1,
        approved_time_upto: new Date('2099-12-31').toISOString()
      };
      
      BulkPassParentRequest.findByToken.mockResolvedValue(mockParentRequest);
      
      // Mock blacklist query to return blacklisted person
      pool.query = jest.fn().mockResolvedValueOnce({
        rows: [
          {
            identifier: '123456789012',
            reason: 'Security threat',
            reason_code: 'SECURITY'
          }
        ]
      });
      
      const response = await request(app)
        .post('/api/bulk-pass/public/test-token/submit')
        .send({
          filePaths: ['/tmp/test.xlsx'],
          persons: [{ aadhaarNo: '123456789012' }],
          vehicles: []
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('blacklisted');
      expect(response.body.blacklisted).toBeDefined();
    });
    
    test('should reject submission when vehicle is blacklisted', async () => {
      const mockParentRequest = {
        id: 1,
        approved_time_upto: new Date('2099-12-31').toISOString()
      };
      
      BulkPassParentRequest.findByToken.mockResolvedValue(mockParentRequest);
      
      // Mock blacklist queries
      pool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // Person check passes
        .mockResolvedValueOnce({ // Vehicle check fails
          rows: [
            {
              identifier: 'TN01AB1234',
              reason: 'Stolen vehicle',
              reason_code: 'STOLEN'
            }
          ]
        });
      
      const response = await request(app)
        .post('/api/bulk-pass/public/test-token/submit')
        .send({
          filePaths: ['/tmp/test.xlsx'],
          persons: [{ aadhaarNo: '123456789012' }],
          vehicles: [{ registrationNo: 'TN01AB1234' }]
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('blacklisted');
    });
    
    test('should return 400 when parent not found', async () => {
      BulkPassParentRequest.findByToken.mockResolvedValue(null);
      BulkPassSchema.getByToken.mockResolvedValue(null);
      
      const response = await request(app)
        .post('/api/bulk-pass/public/invalid-token/submit')
        .send({
          filePaths: ['/tmp/test.xlsx'],
          persons: [{ aadhaarNo: '123456789012' }],
          vehicles: []
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });
    
  });
  
});
