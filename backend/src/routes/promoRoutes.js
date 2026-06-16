const express = require('express');
const router = express.Router();
const { validatePromoCode } = require('../controllers/promoController');
const { authMiddleware } = require('../middleware/authMiddleware');

// POST /api/promo/validate — foydalanuvchi promokodni tekshiradi
router.post('/validate', authMiddleware, validatePromoCode);

module.exports = router;
