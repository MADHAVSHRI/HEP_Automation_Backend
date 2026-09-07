const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateForm13Payload,
  normalizeEirItem,
  validateEirItem,
} = require('../src/validators/tosValidator');

test('validateForm13Payload rejects invalid terminal and empty containers', () => {
  const result = validateForm13Payload({
    terminal: 'INVALID',
    trailerNumber: 'TR123',
    containers: [],
  });

  assert.ok(result.some((message) => message.includes('Invalid terminal')));
  assert.ok(result.some((message) => message.includes('containers is required')));
});

test('normalizeEirItem maps EIR aliases to canonical values', () => {
  const item = normalizeEirItem({
    terminal: 'CCTPL',
    inGateDateTime: '2026-09-02T08:00:00Z',
    outGateDateTime: '2026-09-02T10:00:00Z',
    Container: 'MSCU1234567',
    ISOcode: '2200',
    Emptytruck: 'N',
    ImpExp: 'E',
    LinerID: 'MAEU',
    TruckNumber: 'TN999',
    OocStatus: 'Y',
    Destination: 'MUNDRA',
    MarkedForScanning: 'N',
  });

  assert.equal(item.terminal, 'CCTPL');
  assert.equal(item.movementType, 'Export');
  assert.equal(item.fullEmpty, 'Full');
  assert.equal(item.oocStatus, 'Yes');
  assert.equal(item.markedForScanning, 'No');
  assert.equal(item.containerNumber, 'MSCU1234567');
});

test('validateEirItem requires canonical fields for a valid record', () => {
  const validItem = normalizeEirItem({
    terminal: 'CCTPL',
    inGateDateTime: '2026-09-02T08:00:00Z',
    outGateDateTime: '2026-09-02T10:00:00Z',
    containerNumber: 'MSCU1234567',
    containerISO: '2200',
    containerSize: '20',
    movementType: 'Import',
    fullEmpty: 'Full',
    line: 'MAEU',
    trailerNumber: 'TN999',
    destinationGroup: 'D1',
  });

  const validation = validateEirItem(validItem);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);

  const invalidValidation = validateEirItem({
    terminal: 'BAD',
    movementType: 'Unknown',
    fullEmpty: 'Half',
  });

  assert.equal(invalidValidation.valid, false);
  assert.ok(invalidValidation.errors.length >= 3);
});

test('validateForm13Payload accepts CCTL as valid terminal', () => {
  const result = validateForm13Payload({
    terminal: 'CCTL',
    trailerNumber: 'TR123',
    containers: [
      {
        movementType: 'Export',
        containerNumber: 'MSCU1234567',
        containerISO: '2200',
        containerSize: '20',
      },
    ],
  });

  assert.equal(result.length, 0);
});

test('validateEirItem accepts CCTL terminal', () => {
  const validItem = normalizeEirItem({
    terminal: 'CCTL',
    inGateDateTime: '2026-09-02T08:00:00Z',
    outGateDateTime: '2026-09-02T10:00:00Z',
    containerNumber: 'MSCU1234567',
    containerISO: '2200',
    containerSize: '20',
    movementType: 'Import',
    fullEmpty: 'Full',
    line: 'MAEU',
    trailerNumber: 'TN999',
    destinationGroup: 'D1',
  });

  const validation = validateEirItem(validItem);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
});

test('tosController exports login, pushForm13, and pushEir functions', () => {
  const controller = require('../src/controllers/tosController');
  assert.equal(typeof controller.login, 'function');
  assert.equal(typeof controller.pushForm13, 'function');
  assert.equal(typeof controller.pushEir, 'function');
});

test('models export all required entities and sequelize instance', () => {
  const models = require('../models');
  assert.ok(models.sequelize);
  assert.ok(models.TosOperator);
  assert.ok(models.TosForm13);
  assert.ok(models.TosForm13Container);
  assert.ok(models.TosEirRecord);
});

test.after(async () => {
  try {
    const { eirQueue, eirQueueEvents, eirWorker } = require('../src/queues/eirQueue');
    const { form13Queue, form13QueueEvents, form13Worker } = require('../src/queues/form13Queue');
    const { sequelize } = require('../models');

    await Promise.allSettled([
      eirQueue?.close(),
      eirQueueEvents?.close(),
      eirWorker?.close(),
      form13Queue?.close(),
      form13QueueEvents?.close(),
      form13Worker?.close(),
      sequelize?.close(),
    ]);
  } catch (_) {}
});


