const crypto = require('crypto');
const Driver = require('../models/Driver');
const Ride = require('../models/Ride');
const Transaction = require('../models/Transaction');
const { getSettings } = require('../services/settingsService');
const socketService = require('../services/socketService');
const rideController = require('./rideController');

/**
 * Helper to determine driver debt status
 */
const getDebtStatus = (balance, settings) => {
  const debt = Math.abs(balance);
  if (debt < settings.warningDebtLimit) return 'NORMAL';
  if (debt < settings.blockDebtLimit) return 'WARNING';
  return 'BLOCKED';
};

const handleRideClickPayment = async ({
  click_trans_id,
  merchant_trans_id,
  amount,
  action,
}) => {
  const rideId = merchant_trans_id.replace(/^ride_/, '');
  const ride = await Ride.findById(rideId);

  if (!ride) {
    return { error: -5, error_note: 'Ride does not exist' };
  }

  const paymentAmount = Number(amount);
  if (paymentAmount < Number(ride.price)) {
    return { error: -2, error_note: 'Incorrect payment amount' };
  }

  if (Number(action) === 0) {
    ride.paymentStatus = 'pending';
    await ride.save();
    return {
      click_trans_id,
      merchant_trans_id,
      merchant_prepare_id: ride._id.toString(),
      error: 0,
      error_note: 'Success',
    };
  }

  if (Number(action) === 1) {
    if (ride.paymentStatus === 'paid' && ride.clickTransactionId) {
      return {
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: ride._id.toString(),
        error: 0,
        error_note: 'Already processed',
      };
    }

    ride.paymentMethod = 'click';
    ride.paymentStatus = 'paid';
    ride.status = 'searching';
    ride.clickTransactionId = click_trans_id;
    ride.paidAt = new Date();
    await ride.save();

    await Transaction.create({
      userId: ride.userId,
      type: 'ride_payment',
      amount: paymentAmount,
      rideId: ride._id,
      clickTransactionId: click_trans_id,
      status: 'completed',
      description: `CLICK orqali sayohat to'lovi (#${ride._id.toString().slice(-6)})`,
    });

    socketService.broadcastToAdmins('ridePaymentUpdate', {
      rideId: ride._id.toString(),
      paymentMethod: ride.paymentMethod,
      paymentStatus: ride.paymentStatus,
    });

    socketService.sendToUser(ride.userId.toString(), 'rideStatusUpdate', {
      rideId: ride._id,
      status: 'searching',
      paymentMethod: ride.paymentMethod,
      paymentStatus: ride.paymentStatus,
      message: 'To‘lov qabul qilindi. Haydovchi qidirilmoqda...',
    });

    rideController.dispatchRide(ride._id.toString());

    return {
      click_trans_id,
      merchant_trans_id,
      merchant_confirm_id: ride._id.toString(),
      error: 0,
      error_note: 'Success',
    };
  }

  return { error: -3, error_note: 'Action not found' };
};

/**
 * POST /driver/payments/create
 * Creates a pending payment and returns the Click billing URL
 */
exports.createPayment = async (req, res) => {
  try {
    const driverId = req.user.id;
    const driver = await Driver.findById(driverId);

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Haydovchi topilmadi' });
    }

    const amount = Number(req.body.amount) || Math.abs(driver.balance);
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Sizda faol qarzdorlik mavjud emas' });
    }

    // Create a pending transaction
    const transaction = await Transaction.create({
      driverId: driver._id,
      type: 'topup',
      amount: amount,
      status: 'pending',
      description: 'Qarzdorlikni yopish uchun to\'lov boshlandi',
    });

    const serviceId = process.env.CLICK_SERVICE_ID || '101737';
    const merchantId = process.env.CLICK_MERCHANT_ID || '60286';
    
    // Generate Click Payment URL
    // Format: https://my.click.uz/services/pay?service_id={service_id}&merchant_id={merchant_id}&amount={amount}&transaction_param={transaction_param}
    const transactionParam = driver.driverId ? driver.driverId.toString() : driver._id.toString();
    const paymentUrl = `https://my.click.uz/services/pay?service_id=${serviceId}&merchant_id=${merchantId}&amount=${amount}&transaction_param=${transactionParam}`;

    return res.status(200).json({
      success: true,
      paymentUrl,
      paymentId: transaction._id.toString(),
      amount,
    });
  } catch (error) {
    console.error('Create payment error:', error);
    return res.status(500).json({ success: false, message: 'To\'lov havolasini yaratishda xatolik yuz berdi' });
  }
};

/**
 * POST /payments/click/webhook
 * CLICK webhook endpoint to handle Prepare and Complete actions
 */
exports.clickWebhook = async (req, res) => {
  try {
    const {
      click_trans_id,
      service_id,
      click_paydoc_id,
      merchant_trans_id, // Driver ID passed as transaction_param
      merchant_prepare_id, // Returned on action=1
      amount,
      action, // 0 for Prepare, 1 for Complete
      error,
      error_note,
      sign_time,
      sign_string,
    } = req.body;

    // Validate request parameters
    if (
      click_trans_id === undefined ||
      service_id === undefined ||
      click_paydoc_id === undefined ||
      merchant_trans_id === undefined ||
      amount === undefined ||
      action === undefined ||
      sign_time === undefined ||
      sign_string === undefined
    ) {
      return res.json({ error: -8, error_note: 'Barcha parametrlar kiritilishi shart' });
    }

    // Verify MD5 Signature
    // md5(click_trans_id + service_id + click_paydoc_id + merchant_trans_id + amount + action + sign_time + secret_key)
    const secretKey = process.env.CLICK_SECRET_KEY || 'l6GV5SaJ9U6lgG';
    let rawSign;
    if (Number(action) === 0) {
      rawSign = `${click_trans_id}${service_id}${click_paydoc_id}${merchant_trans_id}${amount}${action}${sign_time}${secretKey}`;
    } else if (Number(action) === 1) {
      rawSign = `${click_trans_id}${service_id}${click_paydoc_id}${merchant_trans_id}${merchant_prepare_id || ''}${amount}${action}${sign_time}${secretKey}`;
    } else {
      return res.json({ error: -3, error_note: 'Action not found' });
    }
    const calculatedSign = crypto.createHash('md5').update(rawSign).digest('hex');

    if (calculatedSign !== sign_string) {
      return res.json({ error: -1, error_note: 'SIGN CHECK FAILED' });
    }

    // Verify Error status from click
    if (Number(error) < 0) {
      return res.json({ error: -9, error_note: `Click error status: ${error_note}` });
    }

    if (String(merchant_trans_id).startsWith('ride_')) {
      const ridePaymentResponse = await handleRideClickPayment({
        click_trans_id,
        merchant_trans_id,
        amount,
        action,
      });
      return res.json(ridePaymentResponse);
    }

    // Check if Driver exists
    let driver;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(merchant_trans_id);
    if (isObjectId) {
      driver = await Driver.findById(merchant_trans_id);
    }
    if (!driver) {
      const parsedId = Number(merchant_trans_id);
      if (!isNaN(parsedId)) {
        driver = await Driver.findOne({ driverId: parsedId });
      }
    }
    if (!driver) {
      return res.json({ error: -5, error_note: 'User does not exist' });
    }

    const paymentAmount = Number(amount);

    // Prepare Action (0)
    if (Number(action) === 0) {
      // Return success prepare response
      return res.json({
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: driver._id.toString(),
        error: 0,
        error_note: 'Success',
      });
    }

    // Complete Action (1)
    if (Number(action) === 1) {
      // Check if transaction has already been processed (idempotency check)
      const existingTransaction = await Transaction.findOne({
        clickTransactionId: click_trans_id,
        status: 'completed',
      });

      if (existingTransaction) {
        return res.json({
          click_trans_id,
          merchant_trans_id,
          merchant_confirm_id: existingTransaction._id.toString(),
          error: 0,
          error_note: 'Already processed',
        });
      }

      const balanceBefore = driver.balance || 0;
      
      // Update balance: balance + paymentAmount
      // If negative (debt), payment reduces it. If overpaid, positive credit is kept.
      driver.balance = balanceBefore + paymentAmount;

      // Check debt limits and block status
      const settings = await getSettings();
      const debt = Math.abs(driver.balance);

      if (debt < settings.blockDebtLimit) {
        driver.isBlocked = false;
      }

      await driver.save();

      // Create a completed top-up transaction
      const transaction = await Transaction.create({
        driverId: driver._id,
        type: 'topup',
        amount: paymentAmount,
        balanceBefore,
        balanceAfter: driver.balance,
        clickTransactionId: click_trans_id,
        status: 'completed',
        description: 'CLICK orqali qarz to\'landi',
      });

      // Update any pending transactions for this driver to completed
      await Transaction.updateMany(
        { driverId: driver._id, type: 'topup', status: 'pending' },
        { $set: { status: 'completed' } }
      );

      // Send Real-time Socket notifications to Driver and Admins
      const status = getDebtStatus(driver.balance, settings);

      socketService.sendToDriver(driver._id.toString(), 'driverDebtUpdate', {
        balance: driver.balance,
        isBlocked: driver.isBlocked,
        totalCommission: driver.totalCommission,
        status: status,
      });

      socketService.broadcastToAdmins('driverDebtUpdate', {
        driverId: driver._id.toString(),
        balance: driver.balance,
        isBlocked: driver.isBlocked,
        totalCommission: driver.totalCommission,
        status: status,
      });

      return res.json({
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: transaction._id.toString(),
        error: 0,
        error_note: 'Success',
      });
    }

    return res.json({ error: -3, error_note: 'Action not found' });
  } catch (error) {
    console.error('Click Webhook error:', error);
    return res.json({ error: -4, error_note: 'Internal server error' });
  }
};
