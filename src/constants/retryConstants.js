'use strict';

const RETRY_REASONS = Object.freeze({
  TIMEOUT: 'TIMEOUT',
  GATEWAY_ERROR: 'GATEWAY_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
});

// Errors that should NOT be retried — permanent failures
const NON_RETRYABLE_ERRORS = Object.freeze([
  'INVALID_CARD',
  'INSUFFICIENT_FUNDS',
  'CARD_EXPIRED',
  'FRAUD_DETECTED',
  'INVALID_AMOUNT',
]);

module.exports = { RETRY_REASONS, NON_RETRYABLE_ERRORS };
