'use strict';

const { v4: uuidv4 } = require('uuid');
const paymentStore = require('../store/paymentStore');
const idempotencyStore = require('../store/idempotencyStore');
const { executeWithRetry } = require('./retryService');
const { processPayment: gatewayProcess } = require('../gateway/gatewayClient');
const concurrencyLock = require('../utils/concurrencyLock');
const { PAYMENT_STATUS } = require('../constants/paymentConstants');
const logger = require('../utils/logger');

/**
 * Initiates a new payment.
 * - Enforces idempotency via the Idempotency-Key header
 * - Immediately returns a PENDING payment
 * - Triggers async gateway processing in the background
 */
const createPayment = async (paymentData, idempotencyKey) => {
  if (idempotencyKey) {
    const cached = idempotencyStore.get(idempotencyKey);
    if (cached) {
      logger.info('[PaymentService] Idempotent request — returning cached response', {
        idempotencyKey,
      });
      return { ...cached.response, idempotent: true };
    }
  }

  const paymentId = uuidv4();

  const payment = paymentStore.create({
    id: paymentId,
    idempotencyKey: idempotencyKey || null,
    amount: paymentData.amount,
    currency: paymentData.currency.toUpperCase(),
    paymentMethod: paymentData.paymentMethod,
    description: paymentData.description || '',
    metadata: paymentData.metadata || {},
    status: PAYMENT_STATUS.PENDING,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gatewayTransactionId: null,
    authCode: null,
    processedAt: null,
    errorCode: null,
    errorMessage: null,
  });

  logger.info('[PaymentService] Payment created', {
    paymentId,
    amount: payment.amount,
    currency: payment.currency,
    paymentMethod: payment.paymentMethod,
  });

  // Fire-and-forget: process asynchronously so the API responds immediately
  _processPaymentAsync(paymentId).catch((err) => {
    logger.error('[PaymentService] Unhandled error in async processing', {
      paymentId,
      error: err.message,
    });
  });

  const response = paymentStore.findById(paymentId);

  if (idempotencyKey) {
    idempotencyStore.set(idempotencyKey, response);
  }

  return response;
};

/**
 * Internal async worker that drives the payment through the gateway.
 * Protected by a concurrency lock so the same payment cannot be
 * processed twice simultaneously (e.g., race between retry + webhook).
 */
const _processPaymentAsync = async (paymentId) => {
  await concurrencyLock.withLock(`payment:${paymentId}`, async () => {
    const payment = paymentStore.findById(paymentId);

    if (!payment) {
      logger.warn('[PaymentService] Payment not found during async processing', { paymentId });
      return;
    }

    if (payment.status !== PAYMENT_STATUS.PENDING) {
      logger.warn('[PaymentService] Skipping — payment is not in PENDING state', {
        paymentId,
        status: payment.status,
      });
      return;
    }

    paymentStore.update(paymentId, { status: PAYMENT_STATUS.PROCESSING });
    logger.info('[PaymentService] Payment moved to PROCESSING', { paymentId });

    try {
      const result = await executeWithRetry(
        async (attempt) => {
          paymentStore.update(paymentId, { retryCount: attempt - 1 });

          const current = paymentStore.findById(paymentId);
          return gatewayProcess({
            paymentId: current.id,
            amount: current.amount,
            currency: current.currency,
            paymentMethod: current.paymentMethod,
            metadata: current.metadata,
          });
        },
        paymentId
      );

      paymentStore.update(paymentId, {
        status: PAYMENT_STATUS.SUCCESS,
        gatewayTransactionId: result.gatewayTransactionId,
        authCode: result.authCode,
        processedAt: result.processedAt,
        errorCode: null,
        errorMessage: null,
      });

      logger.info('[PaymentService] Payment SUCCESS', {
        paymentId,
        gatewayTransactionId: result.gatewayTransactionId,
      });
    } catch (error) {
      paymentStore.update(paymentId, {
        status: PAYMENT_STATUS.FAILED,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message,
      });

      logger.error('[PaymentService] Payment FAILED', {
        paymentId,
        errorCode: error.code,
        errorMessage: error.message,
      });
    }
  });
};

/**
 * Returns a single payment by ID.
 * Throws 404 if not found.
 */
const getPaymentById = (paymentId) => {
  const payment = paymentStore.findById(paymentId);
  if (!payment) {
    const err = new Error('Payment not found');
    err.statusCode = 404;
    err.code = 'PAYMENT_NOT_FOUND';
    throw err;
  }
  return payment;
};

/**
 * Returns all payments in the store.
 */
const getAllPayments = () => paymentStore.findAll();

/**
 * Manually retries a FAILED payment.
 * Only allowed when the current status is FAILED.
 */
const retryPayment = async (paymentId) => {
  const payment = paymentStore.findById(paymentId);

  if (!payment) {
    const err = new Error('Payment not found');
    err.statusCode = 404;
    err.code = 'PAYMENT_NOT_FOUND';
    throw err;
  }

  if (payment.status !== PAYMENT_STATUS.FAILED) {
    const err = new Error(
      `Only FAILED payments can be retried. Current status: ${payment.status}`
    );
    err.statusCode = 400;
    err.code = 'INVALID_RETRY';
    throw err;
  }

  paymentStore.update(paymentId, {
    status: PAYMENT_STATUS.PENDING,
    errorCode: null,
    errorMessage: null,
  });

  logger.info('[PaymentService] Manual retry initiated', { paymentId });

  _processPaymentAsync(paymentId).catch((err) => {
    logger.error('[PaymentService] Retry async error', { paymentId, error: err.message });
  });

  return paymentStore.findById(paymentId);
};

module.exports = { createPayment, getPaymentById, getAllPayments, retryPayment };
