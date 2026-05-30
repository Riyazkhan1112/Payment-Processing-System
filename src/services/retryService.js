'use strict';

const { withExponentialBackoff } = require('../utils/backoff');
const { NON_RETRYABLE_ERRORS } = require('../constants/retryConstants');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Determines whether an error from the gateway should be retried.
 * Non-retryable errors (e.g. INVALID_CARD) are permanent failures.
 */
const isRetryableError = (error) => {
  if (NON_RETRYABLE_ERRORS.includes(error.code)) {
    return false;
  }
  if (error.retryable === false) {
    return false;
  }
  return true;
};

/**
 * Wraps a gateway call with configurable exponential-backoff retry logic.
 * @param {Function} fn        - Async fn receiving the current attempt number
 * @param {string}   paymentId - Used in retry log messages
 * @param {Object}   options   - Overrides for maxAttempts, baseDelay, maxDelay
 */
const executeWithRetry = (fn, paymentId, options = {}) => {
  const retryOptions = {
    maxAttempts: options.maxAttempts || config.retry.maxAttempts,
    baseDelay: options.baseDelay || config.retry.baseDelay,
    maxDelay: options.maxDelay || config.retry.maxDelay,
    isRetryable: isRetryableError,
    onRetry: ({ attempt, delay, error }) => {
      logger.warn('[RetryService] Scheduling retry', {
        paymentId,
        attempt,
        delayMs: delay,
        errorCode: error.code,
        errorMessage: error.message,
      });
    },
  };

  return withExponentialBackoff(fn, retryOptions);
};

module.exports = { executeWithRetry, isRetryableError };
