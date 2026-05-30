'use strict';

const express = require('express');

const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { validateWebhook } = require('../middleware/validateMiddleware');

router.post('/', validateWebhook, webhookController.handleWebhook);

module.exports = router;
