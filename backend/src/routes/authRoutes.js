const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, refreshTokenHandler } = require('../middleware/authMiddleware');
const { otpLimiter, otpVerifyLimiter, loginLimiter, walletLimiter } = require('../middleware/rateLimiter');

// OTP routes with rate limiting
router.post('/otp', otpLimiter, authController.requestOTP);
router.post('/verify', otpVerifyLimiter, authController.verifyOTP);

// Refresh token
router.post('/refresh-token', refreshTokenHandler);

// Admin login with rate limiting
router.post('/admin-login', loginLimiter, authController.adminLogin);

// Protected routes
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.post('/pay-commission', authMiddleware, walletLimiter, authController.payCommission);

module.exports = router;
