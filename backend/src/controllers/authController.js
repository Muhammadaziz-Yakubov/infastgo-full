const User = require('../models/User');
const Driver = require('../models/Driver');
const OTP = require('../models/OTP');
const smsService = require('../services/smsService');
const jwt = require('jsonwebtoken');
const Transaction = require('../models/Transaction');
const { getSettings } = require('../services/settingsService');
const { generateAccessToken, generateRefreshToken } = require('../middleware/authMiddleware');
const auditLog = require('../services/auditLog');


// Request OTP
exports.requestOTP = async (req, res) => {
  try {
    const { phone, isDriverLogin } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Telefon raqam kiritilishi shart' });
    }

    // OTP reuse protection: check if an OTP was recently sent (within last 60 seconds)
    const existingOTP = await OTP.findOne({ phone });
    if (existingOTP) {
      const timeSinceCreated = Date.now() - (existingOTP.expiresAt.getTime() - 5 * 60 * 1000);
      if (timeSinceCreated < 60 * 1000) {
        return res.status(429).json({
          success: false,
          message: 'SMS kod allaqachon yuborilgan. 60 soniya kutib turing.',
          retryAfter: Math.ceil((60 * 1000 - timeSinceCreated) / 1000),
        });
      }
    }

    // If driver login, make sure driver account is created by admin first
    if (isDriverLogin) {
      const driver = await Driver.findOne({ phone });
      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'Ushbu telefon raqamga tegishli haydovchi topilmadi. Iltimos, admin bilan bog\'laning.',
        });
      }
      if (!driver.isActive) {
        return res.status(403).json({ success: false, message: 'Haydovchi hisobi faolsizlantirilgan' });
      }
    }

    // Generate 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save or update OTP (with attempt tracking)
    await OTP.findOneAndUpdate(
      { phone },
      { code, expiresAt, attempts: 0, used: false },
      { upsert: true, new: true }
    );

    // Send SMS
    await smsService.sendOTP(phone, code);

    // Audit log
    await auditLog.log({
      action: 'auth.otp.requested',
      actor: { ip: req.ip },
      target: { type: 'phone', id: phone },
      details: { isDriverLogin },
    });

    // In local development, return code in response for easier testing
    const responseData = { success: true, message: 'OTP tasdiqlash kodi yuborildi' };
    if (process.env.SMS_MODE === 'mock') {
      responseData.devOTP = code; // Only expose OTP in mock mode for development
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Request OTP error:', error);
    return res.status(500).json({ success: false, message: 'SMS yuborishda xatolik yuz berdi' });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, code, isDriverLogin } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Telefon raqam va tasdiqlash kodi kiritilishi shart' });
    }

    // Find and validate OTP
    const otpRecord = await OTP.findOne({ phone });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Tasdiqlash kodi topilmadi. Yangi kod so\'rang.' });
    }

    // Check if OTP was already used (reuse protection)
    if (otpRecord.used) {
      return res.status(400).json({ success: false, message: 'Bu kod allaqachon ishlatilgan. Yangi kod so\'rang.' });
    }

    // Check expiration
    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ phone });
      return res.status(400).json({ success: false, message: 'Tasdiqlash kodi muddati o\'tgan. Yangi kod so\'rang.' });
    }

    // Track attempts (max 5 per OTP)
    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ phone });

      await auditLog.log({
        action: 'auth.otp.max_attempts',
        actor: { ip: req.ip },
        target: { type: 'phone', id: phone },
        level: 'warn',
      });

      return res.status(400).json({
        success: false,
        message: 'Urinishlar soni tugadi. Yangi kod so\'rang.',
      });
    }

    // Verify code
    if (otpRecord.code !== code) {
      // Increment attempt counter
      otpRecord.attempts = (otpRecord.attempts || 0) + 1;
      await otpRecord.save();

      return res.status(400).json({
        success: false,
        message: `Tasdiqlash kodi noto'g'ri. ${5 - otpRecord.attempts} ta urinish qoldi.`,
      });
    }

    // Valid OTP - mark as used, then delete
    otpRecord.used = true;
    await otpRecord.save();
    await OTP.deleteOne({ phone });

    let account;
    let role = 'user';

    if (isDriverLogin) {
      // Driver login: Check driver profile
      account = await Driver.findOne({ phone });
      if (!account) {
        return res.status(404).json({ success: false, message: 'Haydovchi topilmadi' });
      }
      role = 'driver';
    } else {
      // User login: Check if user exists or auto-create
      account = await User.findOne({ phone });
      if (!account) {
        // Create user
        account = await User.create({
          phone,
          role: 'user',
        });
      } else {
        role = account.role; // might be admin or user
      }

      if (account.isBlocked) {
        return res.status(403).json({ success: false, message: 'Sizning hisobingiz bloklangan' });
      }
    }

    // Generate both access and refresh tokens
    const token = generateAccessToken(account._id, role);
    const refreshToken = generateRefreshToken(account._id, role);

    // Audit log
    await auditLog.log({
      action: 'auth.login.success',
      actor: { id: account._id, role, ip: req.ip },
      target: { type: isDriverLogin ? 'driver' : 'user', id: account._id },
    });

    return res.status(200).json({
      success: true,
      token,
      refreshToken,
      user: {
        id: account._id,
        phone: account.phone,
        name: account.name,
        surname: account.surname,
        role: role,
        ...(role === 'driver' && {
          status: account.status,
          carInfo: account.carInfo,
          rating: account.rating,
          earnings: account.earnings,
          balance: account.balance || 0,
          isBlocked: account.isBlocked || false,
          pendingCommission: account.balance < 0 ? Math.abs(account.balance) : 0,
          totalCommissionPaid: account.totalCommissionPaid || 0,
        }),
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ success: false, message: 'Tizimga kirishda xatolik yuz berdi' });
  }
};

// Get profile
exports.getProfile = async (req, res) => {
  try {
    const { id, role } = req.user;

    let account;
    if (role === 'driver') {
      account = await Driver.findById(id);
    } else {
      account = await User.findById(id);
    }

    if (!account) {
      return res.status(404).json({ success: false, message: 'Hisob topilmadi' });
    }

    if (role !== 'driver' && account.isBlocked) {
      return res.status(403).json({ success: false, message: 'Sizning hisobingiz bloklangan' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: account._id,
        phone: account.phone,
        name: account.name,
        surname: account.surname,
        role: role,
        ...(role === 'driver' && {
          status: account.status,
          carInfo: account.carInfo,
          rating: account.rating,
          earnings: account.earnings,
          balance: account.balance || 0,
          isBlocked: account.isBlocked || false,
          pendingCommission: account.balance < 0 ? Math.abs(account.balance) : 0,
          totalCommissionPaid: account.totalCommissionPaid || 0,
        }),
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ success: false, message: 'Profil ma\'lumotlarini yuklashda xatolik' });
  }
};

// Update profile name/surname/status
exports.updateProfile = async (req, res) => {
  try {
    const { id, role } = req.user;
    const { name, surname, status } = req.body;

    let account;
    if (role === 'driver') {
      const driver = await Driver.findById(id);
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Haydovchi topilmadi' });
      }

      const settings = await getSettings();
      const debt = Math.abs(driver.balance || 0);

      // Prevent blocked drivers from going online
      if (status === 'online') {
        if (driver.isBlocked || debt >= settings.blockDebtLimit) {
          driver.isBlocked = true;
          await driver.save();
          return res.status(400).json({
            success: false,
            message: `Qarzdorlik limitingiz oshib ketgan (${settings.blockDebtLimit.toLocaleString()} UZS). Online bo'la olmaymiz. Iltimos, qarzingizni to'lang.`
          });
        }
      }

      if (name !== undefined) driver.name = name;
      if (surname !== undefined) driver.surname = surname;
      if (status !== undefined && ['online', 'offline', 'busy'].includes(status)) {
        driver.status = status;
      }
      account = await driver.save();
    } else {
      if (!name || !surname) {
        return res.status(400).json({ success: false, message: 'Ism va familiya kiritilishi shart' });
      }
      account = await User.findByIdAndUpdate(id, { name, surname }, { new: true });
    }

    if (!account) {
      return res.status(404).json({ success: false, message: 'Profil topilmadi' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: account._id,
        phone: account.phone,
        name: account.name,
        surname: account.surname,
        role: role,
        ...(role === 'driver' && {
          status: account.status,
          carInfo: account.carInfo,
          rating: account.rating,
          earnings: account.earnings,
          balance: account.balance || 0,
          isBlocked: account.isBlocked || false,
          pendingCommission: account.balance < 0 ? Math.abs(account.balance) : 0,
          totalCommissionPaid: account.totalCommissionPaid || 0,
        }),
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Profilni tahrirlashda xatolik yuz berdi' });
  }
};

// Admin Login (Static Credentials)
exports.adminLogin = async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ success: false, message: 'Login va parol kiritilishi shart' });
    }

    if (login === 'Muhammadaziz' && password === 'shodi.19') {
      // Find or create admin user in DB
      let admin = await User.findOne({ role: 'admin' });
      if (!admin) {
        admin = await User.create({
          phone: '+998902710027',
          name: 'Muhammadaziz',
          surname: 'Yakubov',
          role: 'admin',
        });
      }

      const token = generateAccessToken(admin._id, 'admin');
      const refreshToken = generateRefreshToken(admin._id, 'admin');

      await auditLog.log({
        action: 'auth.admin.login',
        actor: { id: admin._id, role: 'admin', ip: req.ip },
        target: { type: 'user', id: admin._id },
      });

      return res.status(200).json({
        success: true,
        token,
        refreshToken,
        user: {
          id: admin._id,
          phone: admin.phone,
          name: admin.name,
          surname: admin.surname,
          role: 'admin',
        },
      });
    } else {
      await auditLog.log({
        action: 'auth.admin.login_failed',
        actor: { ip: req.ip },
        details: { login },
        level: 'warn',
      });

      return res.status(401).json({ success: false, message: 'Login yoki parol noto\'g\'ri!' });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ success: false, message: 'Tizimga kirishda xatolik yuz berdi' });
  }
};

// Pay commission via Mock Click
exports.payCommission = async (req, res) => {
  try {
    const { id, role } = req.user;
    const { amount } = req.body;

    if (role !== 'driver') {
      return res.status(403).json({ success: false, message: 'Faqat haydovchilar komissiya to\'lashi mumkin' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'To\'lov summasi noto\'g\'ri' });
    }

    const driver = await Driver.findById(id);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Haydovchi topilmadi' });
    }

    const prevBalance = driver.balance || 0;
    driver.balance = prevBalance + amount;
    if (driver.balance > 0) {
      driver.balance = 0;
    }

    driver.pendingCommission = Math.abs(driver.balance);
    driver.totalCommissionPaid = (driver.totalCommissionPaid || 0) + amount;

    // Check dynamic block status
    const settings = await getSettings();
    const debt = Math.abs(driver.balance);
    if (debt < settings.blockDebtLimit) {
      driver.isBlocked = false;
    }

    await driver.save();

    // Create a transaction record
    await Transaction.create({
      driverId: driver._id,
      type: 'topup',
      amount: amount,
      balanceBefore: prevBalance,
      balanceAfter: driver.balance,
      status: 'completed',
      description: 'Mock CLICK orqali qarz to\'landi',
    });

    await auditLog.log({
      action: 'payment.commission.paid',
      actor: { id: driver._id, role: 'driver', ip: req.ip },
      target: { type: 'driver', id: driver._id },
      details: { amount, prevBalance, newBalance: driver.balance },
    });

    return res.status(200).json({
      success: true,
      message: `${amount.toLocaleString()} UZS komissiya Click orqali muvaffaqiyatli to'landi`,
      user: {
        id: driver._id,
        phone: driver.phone,
        name: driver.name,
        surname: driver.surname,
        role: 'driver',
        status: driver.status,
        carInfo: driver.carInfo,
        rating: driver.rating,
        earnings: driver.earnings,
        balance: driver.balance,
        isBlocked: driver.isBlocked,
        pendingCommission: driver.pendingCommission,
        totalCommissionPaid: driver.totalCommissionPaid,
      }
    });
  } catch (error) {
    console.error('Pay commission error:', error);
    return res.status(500).json({ success: false, message: 'Komissiya to\'lashda xatolik yuz berdi' });
  }
};
