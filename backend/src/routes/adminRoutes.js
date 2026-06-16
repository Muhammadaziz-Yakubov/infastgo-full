const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const promoController = require('../controllers/promoController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// Wrap with auth and admin verification
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.post('/users/:userId/block', adminController.toggleUserBlock);
router.get('/drivers', adminController.getDrivers);
router.post('/drivers', adminController.createDriver);
router.post('/drivers/:driverId/active', adminController.toggleDriverActive);
router.delete('/drivers/:driverId', adminController.deleteDriver);
router.get('/live', adminController.getLiveTracking);
router.get('/pricing', adminController.getPricing);
router.put('/pricing', adminController.updatePricing);
router.post('/push', adminController.sendPushNotification);

// Commission & Debt Management Routes
router.get('/settings', adminController.getAdminSettings);
router.put('/settings', adminController.updateAdminSettings);
router.get('/drivers/debts', adminController.getDriversDebts);
router.get('/statistics/commissions', adminController.getCommissionsStats);
router.put('/drivers/:driverId/balance', adminController.adjustDriverBalance);

// InFast Eats Admin Routes
router.get('/eats/restaurants', adminController.getEatsRestaurants);
router.post('/eats/restaurants', adminController.createEatsRestaurant);
router.put('/eats/restaurants/:id', adminController.updateEatsRestaurant);
router.post('/eats/restaurants/:id/toggle', adminController.toggleEatsRestaurant);

router.get('/eats/couriers', adminController.getEatsCouriers);
router.post('/eats/couriers', adminController.createEatsCourier);
router.put('/eats/couriers/:id', adminController.updateEatsCourier);

router.get('/eats/orders', adminController.getEatsOrders);
router.get('/eats/analytics', adminController.getEatsAnalytics);

// Promo Code Management
router.get('/promo', promoController.getPromoCodes);
router.post('/promo', promoController.createPromoCode);
router.put('/promo/:id/toggle', promoController.togglePromoCode);
router.delete('/promo/:id', promoController.deletePromoCode);

module.exports = router;
