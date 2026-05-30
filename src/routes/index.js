'use strict';

const express = require('express');

const router = express.Router();
const paymentRoutes = require('./paymentRoutes');
const webhookRoutes = require('./webhookRoutes');

router.use('/payments', paymentRoutes);
router.use('/webhooks', webhookRoutes);

module.exports = router;
