'use strict';

/**
 * Exponential backoff utilities for retry logic.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculates the delay for a given retry attempt using exponential backoff with jitter.
 * Formula: min(baseDelay * 2^(attempt-1) + jitter, maxDelay)
 */
const calculateBackoff = (attempt, baseDelay = 1000, maxDelay = 10000) => {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.floor(exponentialDelay + jitter);
};

/**
 * Executes an async function with exponential backoff retry logic.
 * @param {Function} fn - Async function to execute. Receives current attempt number.
 * @param {Object} options
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {number} options.maxDelay - Max delay cap in ms (default: 10000)
 * @param {Function} options.onRetry - Called before each retry with { attempt, delay, error }
 * @param {Function} options.isRetryable - Determines if an error is retryable (default: always true)
 */
const withExponentialBackoff = async (fn, options = {}) => {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry = null,
    isRetryable = () => true,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (!isRetryable(error) || attempt === maxAttempts) {
        throw error;
      }

      const delay = calculateBackoff(attempt, baseDelay, maxDelay);

      if (onRetry) {
        onRetry({ attempt, delay, error });
      }

      await sleep(delay);
    }
  }

  throw lastError;
};

module.exports = { sleep, calculateBackoff, withExponentialBackoff };
