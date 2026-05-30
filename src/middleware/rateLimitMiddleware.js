'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

const rateLimitResponse = (message) => ({
  success: false,
  error: {
    message,
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Global API rate limiter applied to all routes.
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Too many requests. Please try again later.'),
});

/**
 * Stricter limiter applied only to payment creation and retry endpoints.
 */
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Too many payment requests. Please slow down and retry.'),
});

module.exports = { apiLimiter, paymentLimiter };
