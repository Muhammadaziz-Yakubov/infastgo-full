const express = require('express');
const router = express.Router();
const eatsCourierController = require('../controllers/eatsCourierController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Public login
router.post('/login', eatsCourierController.login);

// Protected courier endpoints
router.put('/status', authMiddleware, eatsCourierController.toggleOnline);
router.put('/location', authMiddleware, eatsCourierController.updateLocation);
router.post('/deliveries/:orderId/accept', authMiddleware, eatsCourierController.acceptOrder);
router.put('/deliveries/:orderId/pickup', authMiddleware, eatsCourierController.pickupOrder);
router.put('/deliveries/:orderId/complete', authMiddleware, eatsCourierController.completeDelivery);
router.get('/profile', authMiddleware, eatsCourierController.getProfile);
router.get('/history', authMiddleware, eatsCourierController.getHistory);

module.exports = router;
