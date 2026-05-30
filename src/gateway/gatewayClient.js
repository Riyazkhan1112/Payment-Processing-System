'use strict';

const config = require('../config');
const { createHttpClient } = require('../utils/httpClient');
const { simulateGatewayCall } = require('./gatewaySimulator');
const CircuitBreaker = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

const circuitBreaker = new CircuitBreaker('payment-gateway', {
  failureThreshold: config.circuitBreaker.failureThreshold,
  recoveryTimeout: config.circuitBreaker.recoveryTimeout,
});

const httpClient = createHttpClient(config.gateway.baseUrl, config.gateway.timeout);

/**
 * Sends a payment authorisation request to the external gateway.
 * Falls back to the gateway simulator when SIMULATE_MODE=true.
 */
const processPayment = async (paymentData) => {
  return circuitBreaker.execute(async () => {
    if (config.gateway.simulateMode) {
      logger.info('[GatewayClient] Simulate mode — using gateway simulator', {
        paymentId: paymentData.paymentId,
      });
      return simulateGatewayCall(paymentData);
    }

    // Real third-party gateway call
    logger.info('[GatewayClient] Calling real payment gateway', {
      paymentId: paymentData.paymentId,
      amount: paymentData.amount,
      currency: paymentData.currency,
    });

    const response = await httpClient.post(
      '/v1/payments',
      {
        merchant_transaction_id: paymentData.paymentId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        payment_method: paymentData.paymentMethod,
        metadata: paymentData.metadata || {},
      },
      { headers: { 'X-API-Key': config.gateway.apiKey } }
    );

    return response.data;
  });
};

/**
 * Queries the gateway for the current status of a transaction.
 */
const verifyPayment = async (gatewayTransactionId) => {
  return circuitBreaker.execute(async () => {
    if (config.gateway.simulateMode) {
      return {
        gatewayTransactionId,
        status: 'SUCCESS',
        verifiedAt: new Date().toISOString(),
      };
    }

    const response = await httpClient.get(`/v1/payments/${gatewayTransactionId}`, {
      headers: { 'X-API-Key': config.gateway.apiKey },
    });

    return response.data;
  });
};

const getCircuitBreakerStatus = () => circuitBreaker.getStatus();

module.exports = { processPayment, verifyPayment, getCircuitBreakerStatus };
