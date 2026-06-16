/**
 * walletController.js
 * Handles all wallet, transaction, and withdrawal API endpoints.
 */

const Wallet = require('../models/Wallet');
const EatsTransaction = require('../models/EatsTransaction');
const Withdrawal = require('../models/Withdrawal');
const walletService = require('../services/walletService');

// ─────────────────────────────────────────────
// SHARED: Get my wallet (restaurant or courier)
// ─────────────────────────────────────────────
exports.getMyWallet = async (req, res) => {
  try {
    const ownerId = req.user.id || req.user._id;
    const ownerType = req.user.role === 'restaurant' ? 'restaurant' : 'courier';

    const wallet = await walletService.getOrCreateWallet(ownerId, ownerType);

    // Dynamic cashDebt calculation to prevent out-of-sync data
    const walletObj = wallet.toObject();
    if (ownerType === 'courier') {
      walletObj.cashDebt = wallet.balance < 0 ? -wallet.balance : 0;
    }

    // Recent transactions (last 20)
    const transactions = await EatsTransaction.find({ walletId: wallet._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('orderId', 'items status createdAt');

    return res.json({ success: true, wallet: walletObj, transactions });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// SHARED: Get transaction history
// ─────────────────────────────────────────────
exports.getTransactions = async (req, res) => {
  try {
    const ownerId = req.user.id || req.user._id;
    const ownerType = req.user.role === 'restaurant' ? 'restaurant' : 'courier';
    const { page = 1, limit = 30 } = req.query;

    const wallet = await Wallet.findOne({ ownerId, ownerType });
    if (!wallet) {
      return res.json({ success: true, transactions: [], total: 0 });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [transactions, total] = await Promise.all([
      EatsTransaction.find({ walletId: wallet._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('orderId', 'status createdAt'),
      EatsTransaction.countDocuments({ walletId: wallet._id }),
    ]);

    return res.json({ success: true, transactions, total, page: parseInt(page) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// SHARED: Request withdrawal
// ─────────────────────────────────────────────
exports.requestWithdrawal = async (req, res) => {
  try {
    const ownerId = req.user.id || req.user._id;
    const ownerType = req.user.role === 'restaurant' ? 'restaurant' : 'courier';
    const { amount, cardNumber, paymentMethod } = req.body;

    if (!amount || amount < 10000) {
      return res.status(400).json({ success: false, message: 'Minimal chiqarish miqdori: 10,000 UZS' });
    }
    if (!cardNumber) {
      return res.status(400).json({ success: false, message: 'Karta raqami kiritilmagan.' });
    }

    const wallet = await walletService.getOrCreateWallet(ownerId, ownerType);

    if (wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: `Yetarli balans yo'q. Mavjud: ${wallet.balance.toLocaleString()} UZS`,
      });
    }

    // Check for pending withdrawal
    const existingPending = await Withdrawal.findOne({
      ownerId,
      status: 'pending',
    });
    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: 'Sizning kutilayotgan chiqarish so\'rovingiz allaqachon bor.',
      });
    }

    const withdrawal = await Withdrawal.create({
      walletId: wallet._id,
      ownerId,
      ownerType,
      amount,
      cardNumber,
      paymentMethod: paymentMethod || 'click',
    });

    return res.status(201).json({ success: true, withdrawal });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// SHARED: Get my withdrawal history
// ─────────────────────────────────────────────
exports.getWithdrawals = async (req, res) => {
  try {
    const ownerId = req.user.id || req.user._id;
    const withdrawals = await Withdrawal.find({ ownerId }).sort({ createdAt: -1 }).limit(30);
    return res.json({ success: true, withdrawals });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// COURIER: Settle collected cash
// ─────────────────────────────────────────────
exports.settleCourierCash = async (req, res) => {
  try {
    const courierId = req.user.id || req.user._id;
    const { amount, paymentMethod, orderIds } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Noto\'g\'ri miqdor.' });
    }

    const updatedWallet = await walletService.settleCourierCash(
      courierId,
      amount,
      paymentMethod || 'click',
      orderIds || []
    );

    return res.json({
      success: true,
      message: `${amount.toLocaleString()} UZS muvaffaqiyatli topshirildi.`,
      cashDebt: updatedWallet.cashDebt,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// ADMIN: Overview of all wallets
// ─────────────────────────────────────────────
exports.adminOverview = async (req, res) => {
  try {
    const [restaurantWallets, courierWallets, infastWallet] = await Promise.all([
      Wallet.find({ ownerType: 'restaurant' }),
      Wallet.find({ ownerType: 'courier' }),
      Wallet.findOne({ ownerType: 'infast' }),
    ]);

    const totalRestaurantBalance = restaurantWallets.reduce((s, w) => s + w.balance, 0);
    const totalCourierBalance = courierWallets.reduce((s, w) => s + w.balance, 0);
    const totalCourierCashDebt = courierWallets.reduce((s, w) => s + (w.balance < 0 ? -w.balance : 0), 0);
    const totalCourierEarned = courierWallets.reduce((s, w) => s + w.totalEarned, 0);
    const totalRestaurantEarned = restaurantWallets.reduce((s, w) => s + w.totalEarned, 0);

    // Pending withdrawals
    const pendingWithdrawals = await Withdrawal.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(50);

    const pendingWithdrawalTotal = pendingWithdrawals.reduce((s, w) => s + w.amount, 0);

    // Recent transactions (last 50)
    const recentTransactions = await EatsTransaction.find()
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({
      success: true,
      overview: {
        infastBalance: infastWallet?.balance || 0,
        infastTotalEarned: infastWallet?.totalEarned || 0,
        totalRestaurantBalance,
        totalRestaurantEarned,
        totalCourierBalance,
        totalCourierEarned,
        totalCourierCashDebt,
        pendingWithdrawalTotal,
        pendingWithdrawalsCount: pendingWithdrawals.length,
      },
      pendingWithdrawals,
      recentTransactions,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// ADMIN: Update withdrawal status
// ─────────────────────────────────────────────
exports.adminUpdateWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    const validStatuses = ['approved', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Noto\'g\'ri status.' });
    }

    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Chiqarish so\'rovi topilmadi.' });
    }

    if (withdrawal.status !== 'pending' && status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Bu so\'rov allaqachon qayta ishlangan.' });
    }

    // If approving: deduct from wallet
    if (status === 'approved' || status === 'completed') {
      try {
        await walletService.processWithdrawal(withdrawal.walletId, withdrawal.amount);
      } catch (deductErr) {
        return res.status(400).json({ success: false, message: deductErr.message });
      }
    }

    withdrawal.status = status;
    withdrawal.adminNote = adminNote || '';
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    return res.json({ success: true, withdrawal });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// ADMIN: All withdrawals list
// ─────────────────────────────────────────────
exports.adminGetWithdrawals = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const withdrawals = await Withdrawal.find(filter).sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, withdrawals });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
