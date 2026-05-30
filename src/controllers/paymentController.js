'use strict';

const paymentService = require('../services/paymentService');
const { getCircuitBreakerStatus } = require('../gateway/gatewayClient');
const logger = require('../utils/logger');

/**
 * POST /api/v1/payments
 * Initiates a new payment. Supports idempotency via the `Idempotency-Key` header.
 */
const createPayment = async (req, res, next) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] || null;
    const payment = await paymentService.createPayment(req.body, idempotencyKey);

    const statusCode = payment.idempotent ? 200 : 201;

    logger.info('[PaymentController] Payment initiation response sent', {
      paymentId: payment.id,
      idempotent: !!payment.idempotent,
    });

    return res.status(statusCode).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/payments/:id
 * Fetches the current state of a single payment.
 */
const getPayment = async (req, res, next) => {
  try {
    const payment = paymentService.getPaymentById(req.params.id);
    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/payments
 * Returns all payments in the in-memory store.
 */
const getAllPayments = async (req, res, next) => {
  try {
    const payments = paymentService.getAllPayments();
    return res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/payments/:id/retry
 * Manually retries a FAILED payment.
 */
const retryPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.retryPayment(req.params.id);
    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/payments/health
 * System health check — includes circuit breaker state.
 */
const getHealth = (_req, res) => {
  return res.status(200).json({
    success: true,
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    circuitBreaker: getCircuitBreakerStatus(),
  });
};

module.exports = { createPayment, getPayment, getAllPayments, retryPayment, getHealth };
