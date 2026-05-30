'use strict';

jest.mock('../../src/gateway/gatewayClient', () => ({
  processPayment: jest.fn().mockResolvedValue({
    gatewayTransactionId: 'GTX-INT-001',
    status: 'SUCCESS',
    processedAt: new Date().toISOString(),
    authCode: 'INTAUTH01',
  }),
  getCircuitBreakerStatus: jest.fn().mockReturnValue({
    name: 'payment-gateway',
    state: 'CLOSED',
    failureCount: 0,
    lastFailureTime: null,
  }),
}));

const request = require('supertest');
const app = require('../../src/app');
const paymentStore = require('../../src/store/paymentStore');
const idempotencyStore = require('../../src/store/idempotencyStore');
const { PAYMENT_STATUS } = require('../../src/constants/paymentConstants');

const validPayload = {
  amount: 500,
  currency: 'INR',
  paymentMethod: 'CREDIT_CARD',
  description: 'Integration test payment',
};

beforeEach(() => {
  paymentStore.clear();
  idempotencyStore.clear();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// POST /api/v1/payments
// ---------------------------------------------------------------------------
describe('POST /api/v1/payments', () => {
  it('should create a payment and return 201', async () => {
    const res = await request(app).post('/api/v1/payments').send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(PAYMENT_STATUS.PENDING);
    expect(res.body.data.id).toBeDefined();
  });

  it('should return 400 when amount is missing', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .send({ currency: 'INR', paymentMethod: 'CREDIT_CARD' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for a negative amount', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .send({ ...validPayload, amount: -100 });
    expect(res.status).toBe(400);
  });

  it('should return 400 for an unsupported currency', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .send({ ...validPayload, currency: 'XYZ' });
    expect(res.status).toBe(400);
  });

  it('should return 400 for an invalid paymentMethod', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .send({ ...validPayload, paymentMethod: 'BITCOIN' });
    expect(res.status).toBe(400);
  });

  it('should return 200 for idempotent duplicate request', async () => {
    const key = 'unique-idem-key-integration';
    const first = await request(app)
      .post('/api/v1/payments')
      .set('idempotency-key', key)
      .send(validPayload);
    const second = await request(app)
      .post('/api/v1/payments')
      .set('idempotency-key', key)
      .send(validPayload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.idempotent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/payments
// ---------------------------------------------------------------------------
describe('GET /api/v1/payments', () => {
  it('should return an empty list when no payments exist', async () => {
    const res = await request(app).get('/api/v1/payments');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('should return all created payments', async () => {
    await request(app).post('/api/v1/payments').send(validPayload);
    await request(app).post('/api/v1/payments').send({ ...validPayload, amount: 999 });
    const res = await request(app).get('/api/v1/payments');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/payments/:id
// ---------------------------------------------------------------------------
describe('GET /api/v1/payments/:id', () => {
  it('should return a payment by ID', async () => {
    const createRes = await request(app).post('/api/v1/payments').send(validPayload);
    const { id } = createRes.body.data;

    const res = await request(app).get(`/api/v1/payments/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it('should return 404 for a non-existent payment', async () => {
    const res = await request(app).get('/api/v1/payments/non-existent-id');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/payments/:id/retry
// ---------------------------------------------------------------------------
describe('POST /api/v1/payments/:id/retry', () => {
  it('should retry a FAILED payment and return PENDING', async () => {
    const createRes = await request(app).post('/api/v1/payments').send(validPayload);
    const { id } = createRes.body.data;
    paymentStore.update(id, { status: PAYMENT_STATUS.FAILED });

    const res = await request(app).post(`/api/v1/payments/${id}/retry`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(PAYMENT_STATUS.PENDING);
  });

  it('should return 400 when retrying a non-FAILED payment', async () => {
    const createRes = await request(app).post('/api/v1/payments').send(validPayload);
    const { id } = createRes.body.data;

    const res = await request(app).post(`/api/v1/payments/${id}/retry`);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/payments/health
// ---------------------------------------------------------------------------
describe('GET /api/v1/payments/health', () => {
  it('should return 200 with status OK', async () => {
    const res = await request(app).get('/api/v1/payments/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.circuitBreaker).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/webhooks
// ---------------------------------------------------------------------------
describe('POST /api/v1/webhooks', () => {
  it('should update payment status via webhook', async () => {
    const createRes = await request(app).post('/api/v1/payments').send(validPayload);
    const paymentId = createRes.body.data.id;
    paymentStore.update(paymentId, { status: PAYMENT_STATUS.PROCESSING });

    const res = await request(app).post('/api/v1/webhooks').send({
      eventId: 'evt-webhook-001',
      paymentId,
      gatewayTransactionId: 'GTX-WH-001',
      status: 'SUCCESS',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(res.body.data.payment.status).toBe(PAYMENT_STATUS.SUCCESS);
  });

  it('should handle duplicate webhook events gracefully', async () => {
    const createRes = await request(app).post('/api/v1/payments').send(validPayload);
    const paymentId = createRes.body.data.id;
    paymentStore.update(paymentId, { status: PAYMENT_STATUS.PROCESSING });

    const webhookPayload = {
      eventId: 'evt-dup-002',
      paymentId,
      status: 'SUCCESS',
    };

    await request(app).post('/api/v1/webhooks').send(webhookPayload);
    const second = await request(app).post('/api/v1/webhooks').send(webhookPayload);

    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);
  });

  it('should ignore invalid state transitions', async () => {
    const createRes = await request(app).post('/api/v1/payments').send(validPayload);
    const paymentId = createRes.body.data.id;
    // Payment is PENDING, transition PENDING -> SUCCESS is invalid
    const res = await request(app).post('/api/v1/webhooks').send({
      eventId: 'evt-invalid-003',
      paymentId,
      status: 'SUCCESS',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.ignored).toBe(true);
  });

  it('should return 400 when required webhook fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks')
      .send({ eventId: 'evt-004' }); // missing paymentId and status
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 for a webhook referencing a non-existent payment', async () => {
    const res = await request(app).post('/api/v1/webhooks').send({
      eventId: 'evt-005',
      paymentId: 'ghost-payment-id',
      status: 'SUCCESS',
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Unknown routes
// ---------------------------------------------------------------------------
describe('Unknown routes', () => {
  it('should return 404 for unregistered paths', async () => {
    const res = await request(app).get('/api/v1/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
