'use strict';

const axios = require('axios');
const logger = require('./logger');

/**
 * Creates a pre-configured Axios HTTP client with request/response logging.
 * Used for real third-party gateway calls when SIMULATE_MODE=false.
 */
const createHttpClient = (baseURL, timeout = 5000) => {
  const client = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  client.interceptors.request.use(
    (config) => {
      logger.debug(`[HTTP] --> ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      return config;
    },
    (error) => {
      logger.error('[HTTP] Request setup error', { message: error.message });
      return Promise.reject(error);
    }
  );

  client.interceptors.response.use(
    (response) => {
      logger.debug(`[HTTP] <-- ${response.status} ${response.config.url}`);
      return response;
    },
    (error) => {
      if (error.code === 'ECONNABORTED') {
        logger.error('[HTTP] Timeout', { url: error.config?.url });
        error.retryable = true;
      } else {
        logger.error('[HTTP] Response error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
        });
      }
      return Promise.reject(error);
    }
  );

  return client;
};

module.exports = { createHttpClient };
