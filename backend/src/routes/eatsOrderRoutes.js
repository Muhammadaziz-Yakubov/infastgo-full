const express = require('express');
const router = express.Router();
const eatsOrderController = require('../controllers/eatsOrderController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Get nearest restaurants list
router.get('/restaurants', authMiddleware, eatsOrderController.getRestaurants);

// Get order history (MUST be before parameterized routes)
router.get('/orders/history', authMiddleware, eatsOrderController.getOrderHistory);

// Get restaurant menu (grouped categories)
router.get('/restaurants/:id', authMiddleware, eatsOrderController.getRestaurantDetail);


// Create food order
router.post('/orders', authMiddleware, eatsOrderController.createOrder);

// Update order status (accept, preparing, ready, rejected)
router.put('/orders/:id/status', authMiddleware, eatsOrderController.updateOrderStatus);

// Track order status and courier details
router.get('/orders/:id/track', authMiddleware, eatsOrderController.trackOrder);

// Rate a delivered order
router.post('/orders/:id/rate', authMiddleware, eatsOrderController.rateOrder);

module.exports = router;
