const express = require('express');
const router = express.Router();
const eatsRestaurantController = require('../controllers/eatsRestaurantController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Public route for restaurant authentication
router.post('/login', eatsRestaurantController.login);

// Protected routes for restaurant panel
router.get('/dashboard/stats', authMiddleware, eatsRestaurantController.getDashboardStats);
router.get('/orders', authMiddleware, eatsRestaurantController.getOrders);

// Menu management
router.get('/menu', authMiddleware, eatsRestaurantController.getMenu);
router.post('/menu', authMiddleware, eatsRestaurantController.addMenuItem);
router.put('/menu/:id', authMiddleware, eatsRestaurantController.updateMenuItem);
router.delete('/menu/:id', authMiddleware, eatsRestaurantController.deleteMenuItem);

module.exports = router;
