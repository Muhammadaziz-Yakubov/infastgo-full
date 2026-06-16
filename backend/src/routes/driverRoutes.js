const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const paymentController = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Wrap with authentication
router.use(authMiddleware);

router.get('/balance', driverController.getBalance);
router.get('/debt-status', driverController.getDebtStatus);
router.post('/payments/create', paymentController.createPayment);

module.exports = router;
