'use strict';

const logger = require('../utils/logger');

/**
 * Logs every inbound HTTP request with method, path, and IP.
 */
const requestLogger = (req, _res, next) => {
  logger.info(`--> ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
};

module.exports = { requestLogger };
