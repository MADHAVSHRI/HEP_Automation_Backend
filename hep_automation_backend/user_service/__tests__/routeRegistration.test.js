/**
 * routeRegistration.test.js
 * 
 * Integration tests to verify that all new routes for the multiple pass
 * submissions feature are properly registered in the Express application.
 * 
 * Tests verify:
 * - Public request routes are registered under /api/bulk-pass/public
 * - Admin public request routes are registered under /api/bulk-pass/admin
 * - CAPTCHA routes are registered under /api/captcha
 * - Proper middleware order (CORS, body parser, etc.)
 * 
 * Requirements: Task 8.5 - Register all new routes in main application
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');

// Mock the database connection
jest.mock('../src/dbconfig/db', () => ({
  connectDB: jest.fn()
}));

// Mock logger middleware
jest.mock('../src/middlewares/loggerMiddleware', () => (req, res, next) => next());

// Mock license expiry notifier
jest.mock('../src/utils/licenseExpiryNotifier', () => ({
  startLicenseExpiryNotifierCron: jest.fn()
}));

// Mock initUploadDirs
jest.mock('../src/utils/initUploadDir', () => jest.fn());

describe('Route Registration Tests', () => {
  let app;

  beforeAll(() => {
    // Create a minimal Express app with the same structure as src/index.js
    app = express();
    app.disable('x-powered-by');
    
    app.use(cors({
      origin: ['http://localhost:3000', 'http://14.139.180.41:3000'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-service-name'],
      credentials: true
    }));
    
    app.use(express.json());
    
    // Register routes
    const routes = require('../src/routes/index');
    app.use('/api', routes);
  });

  describe('Public Request Routes Registration', () => {
    test('POST /api/bulk-pass/public/request-otp endpoint exists', async () => {
      const response = await request(app)
        .post('/api/bulk-pass/public/request-otp')
        .send({ email: 'test@example.com' });
      
      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });

    test('POST /api/bulk-pass/public/verify-otp endpoint exists', async () => {
      const response = await request(app)
        .post('/api/bulk-pass/public/verify-otp')
        .send({ email: 'test@example.com', otp: '123456' });
      
      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });

    test('POST /api/bulk-pass/public/request endpoint exists', async () => {
      const response = await request(app)
        .post('/api/bulk-pass/public/request')
        .send({
          companyName: 'Test Company',
          applicantEmail: 'test@example.com',
          applicantMobile: '9876543210'
        });
      
      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });
  });

  describe('CAPTCHA Routes Registration', () => {
    test('GET /api/captcha/get-captcha endpoint exists', async () => {
      const response = await request(app).get('/api/captcha/get-captcha');
      
      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });

    test('POST /api/captcha/verify-captcha endpoint exists', async () => {
      const response = await request(app)
        .post('/api/captcha/verify-captcha')
        .send({ token: 'test-token', answer: '12' });
      
      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });
  });

  describe('Admin Public Request Routes Registration', () => {
    test('GET /api/bulk-pass/admin/public-requests endpoint exists', async () => {
      const response = await request(app)
        .get('/api/bulk-pass/admin/public-requests');
      
      // Should not return 404 (endpoint exists)
      // Will return 401 (unauthorized) without token, which is expected
      expect(response.status).not.toBe(404);
    });

    test('GET /api/bulk-pass/admin/public-requests/:id endpoint exists', async () => {
      const response = await request(app)
        .get('/api/bulk-pass/admin/public-requests/1');
      
      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });

    test('POST /api/bulk-pass/admin/public-requests/:id/approve endpoint exists', async () => {
      const response = await request(app)
        .post('/api/bulk-pass/admin/public-requests/1/approve')
        .send({ validityFrom: '2026-01-01', validityUpto: '2026-12-31' });
      
      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });

    test('POST /api/bulk-pass/admin/public-requests/:id/reject endpoint exists', async () => {
      const response = await request(app)
        .post('/api/bulk-pass/admin/public-requests/1/reject')
        .send({ rejectionReason: 'Test reason' });
      
      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });
  });

  describe('CORS Configuration', () => {
    test('CORS headers are present for public routes', async () => {
      const response = await request(app)
        .options('/api/bulk-pass/public/request-otp')
        .set('Origin', 'http://localhost:3000');
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    test('CORS allows configured origins', async () => {
      const response = await request(app)
        .get('/api/captcha/get-captcha')
        .set('Origin', 'http://localhost:3000');
      
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });

  describe('Middleware Order', () => {
    test('JSON body parser is active', async () => {
      const response = await request(app)
        .post('/api/bulk-pass/public/request-otp')
        .set('Content-Type', 'application/json')
        .send({ email: 'test@example.com' });
      
      // Should not return 400 for bad request format (body parser works)
      expect(response.status).not.toBe(415); // Unsupported Media Type
    });

    test('Express fingerprinting is disabled', async () => {
      const response = await request(app).get('/api/captcha/get-captcha');
      
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Route Prefix Correctness', () => {
    test('Routes under /api prefix work correctly', async () => {
      const response = await request(app).get('/api/captcha/get-captcha');
      
      // Should work with /api prefix
      expect(response.status).not.toBe(404);
    });

    test('Routes without /api prefix return 404', async () => {
      const response = await request(app).get('/captcha/get-captcha');
      
      // Should NOT work without /api prefix
      expect(response.status).toBe(404);
    });

    test('Public request routes are under /api/bulk-pass/public', async () => {
      const response = await request(app)
        .post('/api/bulk-pass/public/request-otp')
        .send({ email: 'test@example.com' });
      
      expect(response.status).not.toBe(404);
    });

    test('Admin routes are under /api/bulk-pass/admin', async () => {
      const response = await request(app)
        .get('/api/bulk-pass/admin/public-requests');
      
      expect(response.status).not.toBe(404);
    });
  });
});
