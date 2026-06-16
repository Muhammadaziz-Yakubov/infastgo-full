const express = require('express');
const router = express.Router();
const courierController = require('../controllers/courierController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/profile', authMiddleware, courierController.getCourierProfile);
router.post('/toggle-status', authMiddleware, courierController.toggleStatus);
router.post('/orders/:orderId/accept', authMiddleware, courierController.acceptDelivery);
router.post('/orders/:orderId/complete', authMiddleware, courierController.completeDelivery);

module.exports = router;
