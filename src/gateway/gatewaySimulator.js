'use strict';

const { sleep } = require('../utils/backoff');
const logger = require('../utils/logger');

/**
 * Simulates an external payment gateway with realistic random outcomes:
 *  - SUCCESS  (65%): returns a gateway transaction response
 *  - FAILURE  (20%): throws a non-retryable or retryable gateway error
 *  - TIMEOUT  (15%): simulates a hung request that exceeds the gateway timeout
 */

const SCENARIOS = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  TIMEOUT: 'TIMEOUT',
  RANDOM: 'RANDOM',
});

const GATEWAY_ERRORS = Object.freeze({
  INSUFFICIENT_FUNDS: {
    code: 'INSUFFICIENT_FUNDS',
    message: 'Insufficient funds in account',
    retryable: false,
  },
  INVALID_CARD: {
    code: 'INVALID_CARD',
    message: 'Invalid card number or details',
    retryable: false,
  },
  CARD_EXPIRED: {
    code: 'CARD_EXPIRED',
    message: 'Card has expired',
    retryable: false,
  },
  FRAUD_DETECTED: {
    code: 'FRAUD_DETECTED',
    message: 'Transaction flagged for suspected fraud',
    retryable: false,
  },
  GATEWAY_ERROR: {
    code: 'GATEWAY_ERROR',
    message: 'Gateway internal server error',
    retryable: true,
  },
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Network connectivity issue at gateway',
    retryable: true,
  },
});

/**
 * Picks a scenario randomly weighted:
 *   65% SUCCESS, 20% FAILURE, 15% TIMEOUT
 */
const pickRandomScenario = () => {
  const rand = Math.random();
  if (rand < 0.65) {
    return SCENARIOS.SUCCESS;
  }
  if (rand < 0.85) {
    return SCENARIOS.FAILURE;
  }
  return SCENARIOS.TIMEOUT;
};

/**
 * Simulates the third-party gateway HTTP call.
 * @param {Object} paymentData - Payment details forwarded to gateway
 * @param {string} scenario    - Force a specific scenario (default: RANDOM)
 */
const simulateGatewayCall = async (paymentData, scenario = SCENARIOS.RANDOM) => {
  // Simulate real network latency: 100ms – 2000ms
  const latency = Math.floor(Math.random() * 1900) + 100;
  await sleep(latency);

  const resolvedScenario =
    scenario === SCENARIOS.RANDOM ? pickRandomScenario() : scenario;

  logger.debug('[GatewaySimulator] Executing scenario', {
    paymentId: paymentData.paymentId,
    scenario: resolvedScenario,
    latencyMs: latency,
  });

  if (resolvedScenario === SCENARIOS.TIMEOUT) {
    // Hold the request long enough to exceed the configured gateway timeout
    await sleep(7000);
    const err = new Error('Gateway request timed out');
    err.code = 'ECONNABORTED';
    err.isTimeout = true;
    err.retryable = true;
    throw err;
  }

  if (resolvedScenario === SCENARIOS.FAILURE) {
    const errorKeys = Object.keys(GATEWAY_ERRORS);
    const pickedKey = errorKeys[Math.floor(Math.random() * errorKeys.length)];
    const template = GATEWAY_ERRORS[pickedKey];
    const err = new Error(template.message);
    err.code = template.code;
    err.retryable = template.retryable;
    throw err;
  }

  // SUCCESS response
  return {
    gatewayTransactionId: `GTX-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)
      .toUpperCase()}`,
    status: 'SUCCESS',
    amount: paymentData.amount,
    currency: paymentData.currency,
    processedAt: new Date().toISOString(),
    gatewayMessage: 'Payment processed successfully',
    authCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
  };
};

module.exports = { simulateGatewayCall, SCENARIOS, GATEWAY_ERRORS };
