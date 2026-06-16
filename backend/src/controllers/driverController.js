const Driver = require('../models/Driver');
const { getSettings } = require('../services/settingsService');

/**
 * GET /driver/balance
 * Returns driver's balance and total commission
 */
exports.getBalance = async (req, res) => {
  try {
    const driverId = req.user.id;
    const driver = await Driver.findById(driverId);
    
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Haydovchi topilmadi' });
    }

    return res.status(200).json({
      success: true,
      balance: driver.balance || 0,
      totalCommission: driver.totalCommission || 0,
      isBlocked: driver.isBlocked || false,
    });
  } catch (error) {
    console.error('Get driver balance error:', error);
    return res.status(500).json({ success: false, message: 'Balansni yuklashda xatolik yuz berdi' });
  }
};

/**
 * GET /driver/debt-status
 * Returns driver's current debt status and limits
 */
exports.getDebtStatus = async (req, res) => {
  try {
    const driverId = req.user.id;
    const driver = await Driver.findById(driverId);

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Haydovchi topilmadi' });
    }

    const settings = await getSettings();
    const debt = Math.abs(driver.balance || 0);

    let status = 'NORMAL';
    if (debt >= settings.blockDebtLimit) {
      status = 'BLOCKED';
    } else if (debt >= settings.warningDebtLimit) {
      status = 'WARNING';
    }

    const limitRemaining = Math.max(0, settings.blockDebtLimit - debt);

    return res.status(200).json({
      success: true,
      balance: driver.balance || 0,
      debt,
      limitRemaining,
      status,
      warningDebtLimit: settings.warningDebtLimit,
      blockDebtLimit: settings.blockDebtLimit,
      commissionPercent: settings.commissionPercent,
    });
  } catch (error) {
    console.error('Get driver debt status error:', error);
    return res.status(500).json({ success: false, message: 'Qarzdorlik holatini yuklashda xatolik yuz berdi' });
  }
};
