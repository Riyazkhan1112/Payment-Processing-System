'use strict';

const express = require('express');

const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { validateCreatePayment } = require('../middleware/validateMiddleware');
const { paymentLimiter } = require('../middleware/rateLimitMiddleware');

// Health check — placed before /:id to avoid route conflict
router.get('/health', paymentController.getHealth);

router.get('/', paymentController.getAllPayments);
router.post('/', paymentLimiter, validateCreatePayment, paymentController.createPayment);
router.get('/:id', paymentController.getPayment);
router.post('/:id/retry', paymentLimiter, paymentController.retryPayment);

module.exports = router;
