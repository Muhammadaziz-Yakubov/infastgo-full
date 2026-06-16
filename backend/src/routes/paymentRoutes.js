const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Public Click webhook route
router.post('/click/webhook', paymentController.clickWebhook);

module.exports = router;
