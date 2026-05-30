'use strict';

require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  gateway: {
    baseUrl: process.env.GATEWAY_BASE_URL || 'https://api.sandbox.paymentgateway.com',
    apiKey: process.env.GATEWAY_API_KEY || 'test_api_key_12345',
    timeout: parseInt(process.env.GATEWAY_TIMEOUT, 10) || 5000,
    simulateMode: process.env.SIMULATE_MODE !== 'false',
  },

  retry: {
    maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS, 10) || 3,
    baseDelay: parseInt(process.env.RETRY_BASE_DELAY, 10) || 1000,
    maxDelay: parseInt(process.env.RETRY_MAX_DELAY, 10) || 10000,
  },

  circuitBreaker: {
    failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD, 10) || 5,
    recoveryTimeout: parseInt(process.env.CB_RECOVERY_TIMEOUT, 10) || 30000,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },
};

module.exports = config;
