const express = require('express');
const router = express.Router();
const foodController = require('../controllers/foodController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Customer endpoints
router.get('/stores', foodController.getStores);
router.get('/stores/:storeId/menu', foodController.getStoreMenu);
router.post('/order', authMiddleware, foodController.createOrder);

// Store dashboard endpoints
router.get('/store/orders', authMiddleware, foodController.getStoreOrders);
router.post('/store/orders/:orderId/status', authMiddleware, foodController.updateOrderStatus);
router.put('/store/menu', authMiddleware, foodController.updateMenu);

module.exports = router;
