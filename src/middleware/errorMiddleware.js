'use strict';

const logger = require('../utils/logger');

/**
 * Central error handler — must be registered last in Express middleware chain.
 * Normalises all thrown errors into a consistent JSON response shape.
 */
const errorMiddleware = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal Server Error' : err.message;

  logger.error(`[ErrorMiddleware] ${err.message}`, {
    statusCode,
    method: req.method,
    path: req.path,
    code: err.code,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });

  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: err.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV !== 'production' && { details: err.stack }),
    },
  });
};

/**
 * 404 handler — catch-all for unmatched routes.
 */
const notFoundMiddleware = (req, res) => {
  return res.status(404).json({
    success: false,
    error: {
      message: `Cannot ${req.method} ${req.path}`,
      code: 'NOT_FOUND',
    },
  });
};

module.exports = { errorMiddleware, notFoundMiddleware };
