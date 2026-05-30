'use strict';

const webhookService = require('../services/webhookService');
const logger = require('../utils/logger');

/**
 * POST /api/v1/webhooks
 * Receives asynchronous status callbacks from the payment gateway.
 * Handles: duplicate events, conflicting states, early/late callbacks.
 */
const handleWebhook = async (req, res, next) => {
  try {
    const { eventId, paymentId, gatewayTransactionId, status, metadata } = req.body;

    logger.info('[WebhookController] Webhook received', { eventId, paymentId, status });

    const result = await webhookService.processWebhook({
      eventId,
      paymentId,
      gatewayTransactionId,
      status,
      metadata,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { handleWebhook };
