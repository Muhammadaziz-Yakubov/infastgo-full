const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────
// SHARED (Restaurant & Courier)
// ─────────────────────────────────────────────

// Get my wallet + recent transactions
router.get('/me', authMiddleware, walletController.getMyWallet);

// Full transaction history (paginated)
router.get('/transactions', authMiddleware, walletController.getTransactions);

// Request a withdrawal
router.post('/withdraw', authMiddleware, walletController.requestWithdrawal);

// Get my withdrawal history
router.get('/withdrawals', authMiddleware, walletController.getWithdrawals);

// ─────────────────────────────────────────────
// COURIER ONLY
// ─────────────────────────────────────────────

// Courier submits collected cash
router.post('/courier/settle', authMiddleware, walletController.settleCourierCash);

// ─────────────────────────────────────────────
// ADMIN ONLY
// ─────────────────────────────────────────────

// Financial overview dashboard
router.get('/admin/overview', authMiddleware, adminMiddleware, walletController.adminOverview);

// All withdrawals (filterable by status)
router.get('/admin/withdrawals', authMiddleware, adminMiddleware, walletController.adminGetWithdrawals);

// Approve / reject / complete a withdrawal
router.put('/admin/withdrawals/:id', authMiddleware, adminMiddleware, walletController.adminUpdateWithdrawal);

module.exports = router;
