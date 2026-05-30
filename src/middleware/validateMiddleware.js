'use strict';

const { PAYMENT_METHODS, CURRENCIES } = require('../constants/paymentConstants');

/**
 * Validates the body of POST /payments requests.
 */
const validateCreatePayment = (req, res, next) => {
  const { amount, currency, paymentMethod } = req.body;
  const errors = [];

  if (amount === undefined || amount === null) {
    errors.push('amount is required');
  } else if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    errors.push('amount must be a positive finite number');
  }

  if (!currency) {
    errors.push('currency is required');
  } else if (!CURRENCIES.includes(currency.toUpperCase())) {
    errors.push(`currency must be one of: ${CURRENCIES.join(', ')}`);
  }

  if (!paymentMethod) {
    errors.push('paymentMethod is required');
  } else if (!Object.values(PAYMENT_METHODS).includes(paymentMethod)) {
    errors.push(`paymentMethod must be one of: ${Object.values(PAYMENT_METHODS).join(', ')}`);
  }

  if (errors.length) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      },
    });
  }

  next();
};

/**
 * Validates the body of POST /webhooks requests.
 */
const validateWebhook = (req, res, next) => {
  const { eventId, paymentId, status } = req.body;
  const errors = [];

  if (!eventId) {
    errors.push('eventId is required');
  }
  if (!paymentId) {
    errors.push('paymentId is required');
  }
  if (!status) {
    errors.push('status is required');
  }

  if (errors.length) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      },
    });
  }

  next();
};

module.exports = { validateCreatePayment, validateWebhook };
