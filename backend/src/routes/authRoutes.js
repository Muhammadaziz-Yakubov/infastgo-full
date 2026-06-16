const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/otp', authController.requestOTP);
router.post('/verify', authController.verifyOTP);
router.post('/admin-login', authController.adminLogin);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.post('/pay-commission', authMiddleware, authController.payCommission);

module.exports = router;
