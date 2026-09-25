/**
 * Tests for the retired legacy `submitBatch` endpoint.
 *
 * The old POST /public/:token/submit path (submitBatch) was superseded by
 * POST /public/:token/submit-rows (submitRowsDirectly) and had multiple security
 * holes (blacklist / per-batch cap / cumulative-budget checks read from the
 * request body while rows were persisted from a re-parsed Excel; no
 * link-revocation or approval gate; no per-pass advisory lock; vehicles never
 * persisted). It is now disabled and returns 410 Gone. Child-batch creation is
 * covered against submitRowsDirectly elsewhere.
 */

const request = require('supertest');
const express = require('express');
const bulkPassController = require('../src/controllers/bulkPassController');

const app = express();
app.use(express.json());
app.post('/api/bulk-pass/public/:token/submit', bulkPassController.submitBatch);

describe('submitBatch - retired endpoint', () => {
  it('returns 410 Gone and points callers to /submit-rows', async () => {
    const res = await request(app)
      .post('/api/bulk-pass/public/sometoken/submit')
      .send({ persons: [], vehicles: [] });

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/submit-rows/i);
  });

  it('does not create anything regardless of payload', async () => {
    const res = await request(app)
      .post('/api/bulk-pass/public/sometoken/submit')
      .send({ persons: [{ name: 'x' }], vehicles: [{ regNo: 'TN01AB1234' }], filePaths: ['/tmp/x.xlsx'] });

    expect(res.status).toBe(410);
  });
});
