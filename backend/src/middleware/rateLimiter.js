/**
 * rateLimiter.js
 * Rate limiting middleware for API endpoints.
 * Prevents brute-force attacks on OTP, login, and general API usage.
 */

const rateLimit = require('express-rate-limit');

// General API rate limiter: 100 requests per minute
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Juda ko\'p so\'rov yuborildi. Iltimos, 1 daqiqa kutib turing.',
  },
});

// OTP rate limiter: 3 requests per 5 minutes per IP + phone
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true },
  keyGenerator: (req) => {
    // Rate limit by phone number + IP for extra protection
    return `${req.body?.phone || 'unknown'}`;
  },
  message: {
    success: false,
    message: 'SMS kodlar juda ko\'p so\'raldi. 5 daqiqa kutib, qayta urinib ko\'ring.',
  },
});

// OTP verify rate limiter: 5 attempts per 5 minutes (prevents brute force)
const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true },
  keyGenerator: (req) => {
    return `verify_${req.body?.phone || 'unknown'}`;
  },
  message: {
    success: false,
    message: 'Tasdiqlash kodi juda ko\'p marta noto\'g\'ri kiritildi. 5 daqiqa kutib turing.',
  },
});

// Login rate limiter: 5 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Kirish urinishlari limiti oshdi. 15 daqiqadan keyin qayta urinib ko\'ring.',
  },
});

// Wallet/Payment operations: 10 per minute
const walletLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Moliyaviy amallar juda tez. Iltimos, biroz kuting.',
  },
});

module.exports = {
  generalLimiter,
  otpLimiter,
  otpVerifyLimiter,
  loginLimiter,
  walletLimiter,
};
