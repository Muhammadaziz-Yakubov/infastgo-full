const User = require('../models/User');
const Driver = require('../models/Driver');
const OTP = require('../models/OTP');
const smsService = require('../services/smsService');
const jwt = require('jsonwebtoken');
const Transaction = require('../models/Transaction');
const { getSettings } = require('../services/settingsService');


// Generate JWT token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Request OTP
exports.requestOTP = async (req, res) => {
  try {
    const { phone, isDriverLogin } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Telefon raqam kiritilishi shart' });
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

    // Save or update OTP
    await OTP.findOneAndUpdate(
      { phone },
      { code, expiresAt },
      { upsert: true, new: true }
    );

    // Send SMS
    await smsService.sendOTP(phone, code);

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
    if (!otpRecord || otpRecord.code !== code || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Tasdiqlash kodi noto\'g\'ri yoki muddati o\'tgan' });
    }

    // Valid OTP - clean it up
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

    const token = generateToken(account._id, role);

    return res.status(200).json({
      success: true,
      token,
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

      const token = generateToken(admin._id, 'admin');

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: admin._id,
          phone: admin.phone,
          name: admin.name,
          surname: admin.surname,
          role: 'admin',
        },
      });
    } else {
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
