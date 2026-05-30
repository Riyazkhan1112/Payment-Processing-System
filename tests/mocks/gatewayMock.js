'use strict';

const mockSuccessResponse = {
  gatewayTransactionId: 'GTX-MOCK-001',
  status: 'SUCCESS',
  amount: 1000,
  currency: 'INR',
  processedAt: new Date().toISOString(),
  authCode: 'MOCK01',
  gatewayMessage: 'Mock payment processed successfully',
};

const mockFailureResponse = {
  code: 'GATEWAY_ERROR',
  message: 'Mock gateway error',
  retryable: true,
};

const mockNonRetryableError = {
  code: 'INVALID_CARD',
  message: 'Invalid card details',
  retryable: false,
};

const createMockGatewayClient = (scenario = 'success') => ({
  processPayment: jest.fn(async () => {
    if (scenario === 'success') {
      return { ...mockSuccessResponse };
    }
    if (scenario === 'failure') {
      const err = new Error(mockFailureResponse.message);
      err.code = mockFailureResponse.code;
      err.retryable = mockFailureResponse.retryable;
      throw err;
    }
    if (scenario === 'non-retryable') {
      const err = new Error(mockNonRetryableError.message);
      err.code = mockNonRetryableError.code;
      err.retryable = mockNonRetryableError.retryable;
      throw err;
    }
    if (scenario === 'timeout') {
      const err = new Error('Gateway timeout');
      err.code = 'ECONNABORTED';
      err.retryable = true;
      throw err;
    }
    return { ...mockSuccessResponse };
  }),
  getCircuitBreakerStatus: jest.fn(() => ({
    name: 'payment-gateway',
    state: 'CLOSED',
    failureCount: 0,
    lastFailureTime: null,
  })),
  verifyPayment: jest.fn(async (gatewayTransactionId) => ({
    gatewayTransactionId,
    status: 'SUCCESS',
    verifiedAt: new Date().toISOString(),
  })),
});

module.exports = { mockSuccessResponse, mockFailureResponse, createMockGatewayClient };
