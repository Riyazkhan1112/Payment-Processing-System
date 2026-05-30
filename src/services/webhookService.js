'use strict';

const paymentStore = require('../store/paymentStore');
const { PAYMENT_STATUS } = require('../constants/paymentConstants');
const logger = require('../utils/logger');

/**
 * Tracks processed webhook event IDs to ensure idempotent handling.
 * Duplicate callbacks with the same eventId are safely ignored.
 */
const processedWebhookEvents = new Set();

/**
 * Valid state machine transitions for webhook-driven updates.
 * Terminal states (SUCCESS, FAILED) do not allow further transitions.
 */
const VALID_TRANSITIONS = {
  [PAYMENT_STATUS.PENDING]: [PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.FAILED],
  [PAYMENT_STATUS.PROCESSING]: [PAYMENT_STATUS.SUCCESS, PAYMENT_STATUS.FAILED],
  [PAYMENT_STATUS.SUCCESS]: [],
  [PAYMENT_STATUS.FAILED]: [],
  [PAYMENT_STATUS.CANCELLED]: [],
};

const isValidTransition = (currentStatus, newStatus) => {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
};

/**
 * Maps external gateway status strings to internal PAYMENT_STATUS values.
 */
const mapGatewayStatus = (gatewayStatus) => {
  const mapping = {
    SUCCESS: PAYMENT_STATUS.SUCCESS,
    COMPLETED: PAYMENT_STATUS.SUCCESS,
    FAILED: PAYMENT_STATUS.FAILED,
    DECLINED: PAYMENT_STATUS.FAILED,
    ERROR: PAYMENT_STATUS.FAILED,
    PROCESSING: PAYMENT_STATUS.PROCESSING,
    PENDING: PAYMENT_STATUS.PENDING,
  };
  return mapping[gatewayStatus?.toUpperCase()] || PAYMENT_STATUS.FAILED;
};

/**
 * Processes an inbound webhook / callback from the payment gateway.
 * Handles: duplicate events, invalid transitions, and conflicting states gracefully.
 */
const processWebhook = async (webhookData) => {
  const { eventId, paymentId, gatewayTransactionId, status, metadata } = webhookData;

  // Idempotency — ignore already-processed events
  if (processedWebhookEvents.has(eventId)) {
    logger.info('[WebhookService] Duplicate webhook ignored', { eventId, paymentId });
    return { duplicate: true, message: 'Webhook already processed' };
  }

  const payment = paymentStore.findById(paymentId);

  if (!payment) {
    logger.warn('[WebhookService] Payment not found for webhook', { eventId, paymentId });
    const err = new Error('Payment not found');
    err.statusCode = 404;
    throw err;
  }

  const mappedStatus = mapGatewayStatus(status);

  // Reject invalid state transitions (e.g. SUCCESS -> FAILED conflict)
  if (!isValidTransition(payment.status, mappedStatus)) {
    logger.warn('[WebhookService] Ignoring invalid state transition', {
      eventId,
      paymentId,
      currentStatus: payment.status,
      requestedStatus: mappedStatus,
    });
    return {
      ignored: true,
      message: `Transition from ${payment.status} to ${mappedStatus} is not allowed`,
      currentStatus: payment.status,
    };
  }

  const updated = paymentStore.update(paymentId, {
    status: mappedStatus,
    gatewayTransactionId: gatewayTransactionId || payment.gatewayTransactionId,
    webhookReceivedAt: new Date().toISOString(),
    webhookMetadata: metadata || {},
  });

  processedWebhookEvents.add(eventId);

  logger.info('[WebhookService] Payment updated via webhook', {
    eventId,
    paymentId,
    previousStatus: payment.status,
    newStatus: mappedStatus,
  });

  return { success: true, payment: updated };
};

module.exports = { processWebhook };
