'use strict';

const express = require('express');
const { apiLimiter } = require('./middleware/rateLimitMiddleware');
const { requestLogger } = require('./middleware/requestLogger');
const { errorMiddleware, notFoundMiddleware } = require('./middleware/errorMiddleware');
const routes = require('./routes');

const app = express();

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limiting
app.use(apiLimiter);

// Request logging
app.use(requestLogger);

// API routes
app.use('/api/v1', routes);

// 404 — must come after all valid routes
app.use(notFoundMiddleware);

// Centralised error handler — must be last
app.use(errorMiddleware);

module.exports = app;
