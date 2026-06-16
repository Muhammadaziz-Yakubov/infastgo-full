const User = require('../models/User');
const Driver = require('../models/Driver');
const Ride = require('../models/Ride');
const Config = require('../models/Config');
const Settings = require('../models/Settings');
const Transaction = require('../models/Transaction');
const { getSettings } = require('../services/settingsService');
const socketService = require('../services/socketService');

// Dashboard Stats
exports.getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalDrivers = await Driver.countDocuments();
    const activeRides = await Ride.countDocuments({
      status: { $in: ['searching', 'accepted', 'arriving', 'started'] },
    });

    const completedRides = await Ride.find({ status: 'completed' });
    const revenue = completedRides.reduce((sum, ride) => sum + ride.price, 0);

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalDrivers,
        activeRides,
        revenue,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ success: false, message: 'Statistikani yuklashda xatolik' });
  }
};

// Users List
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Admin get users error:', error);
    return res.status(500).json({ success: false, message: 'Foydalanuvchilarni yuklashda xatolik' });
  }
};

// Toggle User Block Status
exports.toggleUserBlock = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Foydalanuvchi muvaffaqiyatli ${user.isBlocked ? 'bloklandi' : 'blokdan chiqarildi'}`,
      user,
    });
  } catch (error) {
    console.error('Admin block user error:', error);
    return res.status(500).json({ success: false, message: 'Foydalanuvchi holatini o\'zgartirishda xatolik' });
  }
};

// Drivers List
exports.getDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, drivers });
  } catch (error) {
    console.error('Admin get drivers error:', error);
    return res.status(500).json({ success: false, message: 'Haydovchilarni yuklashda xatolik' });
  }
};

// Create Driver Manually
exports.createDriver = async (req, res) => {
  try {
    const { phone, name, surname, carInfo, tariffs } = req.body;

    if (!phone || !name || !surname || !carInfo || !carInfo.make || !carInfo.model || !carInfo.color || !carInfo.plateNumber) {
      return res.status(400).json({ success: false, message: 'Barcha maydonlarni to\'ldirish shart' });
    }

    // Validate tariffs
    const validTariffs = ['standart', 'komfort', 'biznes'];
    let finalTariffs = ['standart']; // default

    if (tariffs) {
      if (!Array.isArray(tariffs) || tariffs.length === 0 || tariffs.length > 2) {
        return res.status(400).json({ success: false, message: 'Ko\'pi bilan 2 ta tarif tanlash mumkin' });
      }
      const invalid = tariffs.some(t => !validTariffs.includes(t));
      if (invalid) {
        return res.status(400).json({ success: false, message: 'Noto\'g\'ri tarif nomi tanlangan' });
      }
      finalTariffs = tariffs;
    }

    // Check if phone already registered (either as user or driver)
    const existingDriver = await Driver.findOne({ phone });
    if (existingDriver) {
      return res.status(400).json({ success: false, message: 'Ushbu telefon raqamli haydovchi allaqachon mavjud' });
    }

    const driver = await Driver.create({
      phone,
      name,
      surname,
      carInfo,
      tariffs: finalTariffs,
      role: 'driver',
      status: 'offline',
    });

    return res.status(201).json({
      success: true,
      message: 'Haydovchi muvaffaqiyatli yaratildi',
      driver,
    });
  } catch (error) {
    console.error('Admin create driver error:', error);
    return res.status(500).json({ success: false, message: 'Haydovchi yaratishda xatolik yuz berdi' });
  }
};

// Toggle Driver Active Status
exports.toggleDriverActive = async (req, res) => {
  try {
    const { driverId } = req.params;
    const driver = await Driver.findById(driverId);

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Haydovchi topilmadi' });
    }

    driver.isActive = !driver.isActive;
    if (!driver.isActive) {
      driver.status = 'offline'; // Force offline if deactivated
    }
    await driver.save();

    return res.status(200).json({
      success: true,
      message: `Haydovchi muvaffaqiyatli ${driver.isActive ? 'faollashtirildi' : 'faolsizlantirildi'}`,
      driver,
    });
  } catch (error) {
    console.error('Admin toggle driver error:', error);
    return res.status(500).json({ success: false, message: 'Haydovchi holatini o\'zgartirishda xatolik' });
  }
};

// Get Live Monitoring Info (All active rides and all drivers)
exports.getLiveTracking = async (req, res) => {
  try {
    const activeRides = await Ride.find({
      status: { $in: ['searching', 'accepted', 'arriving', 'started'] },
    }).populate('userId', 'name surname phone').populate('driverId', 'name surname phone currentLocation');

    const drivers = await Driver.find({}, 'name surname phone status currentLocation carInfo');

    return res.status(200).json({
      success: true,
      activeRides,
      drivers,
    });
  } catch (error) {
    console.error('Admin live tracking error:', error);
    return res.status(500).json({ success: false, message: 'Jonli monitoring ma\'lumotlarini yuklashda xatolik' });
  }
};

// Pricing Management
exports.getPricing = async (req, res) => {
  try {
    let config = await Config.findOne({ key: 'pricing' });
    if (!config) {
      config = await Config.create({
        key: 'pricing',
        tariffs: {
          standart: { baseFare: 5000, pricePerKm: 1500 },
          komfort: { baseFare: 7000, pricePerKm: 2000 },
          biznes: { baseFare: 10000, pricePerKm: 3000 },
        },
        surgeMultiplier: 1.0,
      });
    }
    return res.status(200).json({ success: true, pricing: config });
  } catch (error) {
    console.error('Admin get pricing error:', error);
    return res.status(500).json({ success: false, message: 'Tariflarni yuklashda xatolik' });
  }
};

exports.updatePricing = async (req, res) => {
  try {
    const { tariffs, surgeMultiplier } = req.body;

    let config = await Config.findOne({ key: 'pricing' });
    if (!config) {
      config = new Config({ key: 'pricing' });
    }

    if (tariffs !== undefined) {
      config.tariffs = {
        standart: {
          baseFare: tariffs.standart?.baseFare !== undefined ? tariffs.standart.baseFare : config.tariffs?.standart?.baseFare,
          pricePerKm: tariffs.standart?.pricePerKm !== undefined ? tariffs.standart.pricePerKm : config.tariffs?.standart?.pricePerKm
        },
        komfort: {
          baseFare: tariffs.komfort?.baseFare !== undefined ? tariffs.komfort.baseFare : config.tariffs?.komfort?.baseFare,
          pricePerKm: tariffs.komfort?.pricePerKm !== undefined ? tariffs.komfort.pricePerKm : config.tariffs?.komfort?.pricePerKm
        },
        biznes: {
          baseFare: tariffs.biznes?.baseFare !== undefined ? tariffs.biznes.baseFare : config.tariffs?.biznes?.baseFare,
          pricePerKm: tariffs.biznes?.pricePerKm !== undefined ? tariffs.biznes.pricePerKm : config.tariffs?.biznes?.pricePerKm
        }
      };
    }
    if (surgeMultiplier !== undefined) config.surgeMultiplier = surgeMultiplier;
    config.updatedAt = new Date();

    await config.save();

    return res.status(200).json({
      success: true,
      message: 'Tariflar muvaffaqiyatli yangilandi',
      pricing: config,
    });
  } catch (error) {
    console.error('Admin update pricing error:', error);
    return res.status(500).json({ success: false, message: 'Tariflarni yangilashda xatolik' });
  }
};

// Push Notifications Setup (Simulated Structure)
exports.sendPushNotification = async (req, res) => {
  try {
    const { recipientType, recipientId, title, body } = req.body; // recipientType: 'all', 'users', 'drivers', 'single_user', 'single_driver'

    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Sarlavha va xabar kiritilishi shart' });
    }

    console.log(`[Push Notification Service] Sending Push:`);
    console.log(`- Title: "${title}"`);
    console.log(`- Body: "${body}"`);
    console.log(`- Target: ${recipientType} (${recipientId || 'N/A'})`);

    // Send real-time socket notification to active connections
    const socketSent = socketService.sendSocketNotification({ recipientType, recipientId, title, body });

    return res.status(200).json({
      success: true,
      message: socketSent 
        ? 'Xabarnoma muvaffaqiyatli yuborildi' 
        : 'Xabarnoma yuborildi (hech kim tarmoqda emas yoki xatolik)',
      details: {
        title,
        body,
        recipientType,
        recipientId,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Admin push notification error:', error);
    return res.status(500).json({ success: false, message: 'Xabarnomani yuborishda xatolik yuz berdi' });
  }
};

// GET /admin/settings
exports.getAdminSettings = async (req, res) => {
  try {
    const settings = await getSettings();
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    console.error('Get admin settings error:', error);
    return res.status(500).json({ success: false, message: 'Sozlamalarni yuklashda xatolik' });
  }
};

// PUT /admin/settings
exports.updateAdminSettings = async (req, res) => {
  try {
    const { commissionPercent, warningDebtLimit, blockDebtLimit } = req.body;

    if (commissionPercent === undefined || warningDebtLimit === undefined || blockDebtLimit === undefined) {
      return res.status(400).json({ success: false, message: 'Barcha maydonlar kiritilishi shart' });
    }

    const commPercent = Number(commissionPercent);
    const warnLimit = Number(warningDebtLimit);
    const blockLimit = Number(blockDebtLimit);

    if (isNaN(commPercent) || commPercent < 0 || commPercent > 100) {
      return res.status(400).json({ success: false, message: 'Komissiya foizi 0 va 100 oralig\'ida bo\'lishi kerak' });
    }

    if (isNaN(warnLimit) || warnLimit < 0) {
      return res.status(400).json({ success: false, message: 'Ogohlantirish limiti 0 dan kichik bo\'la olmaydi' });
    }

    if (isNaN(blockLimit) || blockLimit <= warnLimit) {
      return res.status(400).json({ success: false, message: 'Bloklash limiti ogohlantirish limitidan katta bo\'lishi shart' });
    }

    let settings = await Settings.findById('system_settings');
    if (!settings) {
      settings = new Settings({ _id: 'system_settings' });
    }

    settings.commissionPercent = commPercent;
    settings.warningDebtLimit = warnLimit;
    settings.blockDebtLimit = blockLimit;
    await settings.save();

    return res.status(200).json({
      success: true,
      message: 'Tizim sozlamalari muvaffaqiyatli yangilandi',
      settings,
    });
  } catch (error) {
    console.error('Update admin settings error:', error);
    return res.status(500).json({ success: false, message: 'Sozlamalarni yangilashda xatolik' });
  }
};

// GET /admin/drivers/debts
exports.getDriversDebts = async (req, res) => {
  try {
    const { search, page = 1, limit = 10, sortByDebt = 'desc' } = req.query;
    const settings = await getSettings();

    // Build query
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { surname: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    // Since balance is negative, a higher debt means a more negative balance.
    // sortByDebt = 'desc' (highest debt first) => sort balance ascending (-100k, -50k, 0)
    // sortByDebt = 'asc' (lowest debt first) => sort balance descending (0, -50k, -100k)
    const balanceOrder = sortByDebt === 'asc' ? -1 : 1;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalDrivers = await Driver.countDocuments(query);
    const drivers = await Driver.find(query)
      .sort({ balance: balanceOrder })
      .skip(skip)
      .limit(limitNum);

    const formattedDrivers = drivers.map(driver => {
      const debt = Math.abs(driver.balance || 0);
      let status = 'NORMAL';
      if (debt >= settings.blockDebtLimit) {
        status = 'BLOCKED';
      } else if (debt >= settings.warningDebtLimit) {
        status = 'WARNING';
      }
      return {
        _id: driver._id,
        name: driver.name,
        surname: driver.surname,
        phone: driver.phone,
        balance: driver.balance || 0,
        debt,
        totalCommission: driver.totalCommission || 0,
        isBlocked: driver.isBlocked || false,
        status,
        createdAt: driver.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      drivers: formattedDrivers,
      pagination: {
        total: totalDrivers,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalDrivers / limitNum),
      },
    });
  } catch (error) {
    console.error('Get drivers debts error:', error);
    return res.status(500).json({ success: false, message: 'Haydovchilar qarzdorligini yuklashda xatolik' });
  }
};

// GET /admin/statistics/commissions
exports.getCommissionsStats = async (req, res) => {
  try {
    const settings = await getSettings();

    const driverStats = await Driver.aggregate([
      {
        $group: {
          _id: null,
          totalCommission: { $sum: '$totalCommission' },
          totalBalance: { $sum: '$balance' },
        },
      },
    ]);

    const outstandingStats = await Driver.aggregate([
      { $match: { balance: { $lt: 0 } } },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: '$balance' },
        },
      },
    ]);

    const totalCommissionEarned = driverStats[0]?.totalCommission || 0;
    const totalOutstandingDebt = Math.abs(outstandingStats[0]?.totalOutstanding || 0);

    const paidStats = await Transaction.aggregate([
      { $match: { type: 'topup', status: 'completed' } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$amount' },
        },
      },
    ]);

    const totalPaidDebt = paidStats[0]?.totalPaid || Math.max(0, totalCommissionEarned - totalOutstandingDebt);
    const blockedDrivers = await Driver.countDocuments({ isBlocked: true });

    // Warning drivers: warningLimit <= debt < blockLimit
    // Since balance is negative: -blockLimit < balance <= -warningLimit
    const warningDrivers = await Driver.countDocuments({
      balance: {
        $gt: -settings.blockDebtLimit,
        $lte: -settings.warningDebtLimit,
      },
    });

    return res.status(200).json({
      success: true,
      statistics: {
        totalCommissionEarned,
        totalOutstandingDebt,
        totalPaidDebt,
        blockedDrivers,
        warningDrivers,
      },
    });
  } catch (error) {
    console.error('Get commission stats error:', error);
    return res.status(500).json({ success: false, message: 'Komissiya statistikasini yuklashda xatolik' });
  }
};

// DELETE /admin/drivers/:driverId
// Allows admin to permanently delete a driver account
exports.deleteDriver = async (req, res) => {
  try {
    const { driverId } = req.params;
    const driver = await Driver.findById(driverId);

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Haydovchi topilmadi' });
    }

    await Driver.findByIdAndDelete(driverId);

    return res.status(200).json({
      success: true,
      message: `Haydovchi ${driver.name} ${driver.surname} muvaffaqiyatli o'chirildi`,
    });
  } catch (error) {
    console.error('Admin delete driver error:', error);
    return res.status(500).json({ success: false, message: 'Haydovchini o\'chirishda xatolik yuz berdi' });
  }
};

// PUT /admin/drivers/:driverId/balance
// Allows admin to manually adjust a driver's balance (top-up, clear debt)
exports.adjustDriverBalance = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { amount, note } = req.body; // amount: number (can be positive to add or negative to subtract)

    if (amount === undefined || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: 'amount maydoni raqam bo\'lishi shart' });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Haydovchi topilmadi' });
    }

    const prevBalance = driver.balance || 0;
    driver.balance = prevBalance + Number(amount);

    // Auto-unblock if balance is now >= 0 (debt cleared)
    if (driver.balance >= 0 && driver.isBlocked) {
      driver.isBlocked = false;
    }

    await driver.save();

    // Record transaction
    await Transaction.create({
      driverId: driver._id,
      amount: Number(amount),
      type: 'admin_adjustment',
      status: 'completed',
      description: note || 'Admin tomonidan balans tuzatildi',
    }).catch(() => {}); // non-blocking

    return res.status(200).json({
      success: true,
      message: 'Balans muvaffaqiyatli yangilandi',
      driver: {
        _id: driver._id,
        name: driver.name,
        surname: driver.surname,
        balance: driver.balance,
        isBlocked: driver.isBlocked,
      },
    });
  } catch (error) {
    console.error('Adjust driver balance error:', error);
    return res.status(500).json({ success: false, message: 'Balansni yangilashda xatolik' });
  }
};

// InFast Eats Admin Extensions
const Restaurant = require('../models/Restaurant');
const EatsCourier = require('../models/EatsCourier');
const FoodOrder = require('../models/FoodOrder');
const Delivery = require('../models/Delivery');

exports.getEatsRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, restaurants });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createEatsRestaurant = async (req, res) => {
  try {
    const { name, phone, address, lat, lng, category, login, password } = req.body;
    if (!name || !phone || !address || !lat || !lng || !category || !login || !password) {
      return res.status(400).json({ success: false, message: 'Barcha maydonlar to\'ldirilishi shart.' });
    }

    const newRestaurant = await Restaurant.create({
      name,
      phone,
      address,
      location: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
      login,
      password,
      category,
      isActive: true
    });

    return res.status(201).json({ success: true, restaurant: newRestaurant });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateEatsRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, lat, lng, category, login, password, isActive } = req.body;

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restoran topilmadi.' });
    }

    if (name !== undefined) restaurant.name = name;
    if (phone !== undefined) restaurant.phone = phone;
    if (address !== undefined) restaurant.address = address;
    if (lat !== undefined && lng !== undefined) {
      restaurant.location = { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] };
    }
    if (category !== undefined) restaurant.category = category;
    if (login !== undefined) restaurant.login = login;
    if (password !== undefined) restaurant.password = password;
    if (isActive !== undefined) restaurant.isActive = isActive;

    await restaurant.save();
    return res.status(200).json({ success: true, restaurant });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleEatsRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restoran topilmadi.' });
    }

    restaurant.isActive = !restaurant.isActive;
    await restaurant.save();

    return res.status(200).json({ success: true, restaurant });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEatsCouriers = async (req, res) => {
  try {
    const couriers = await EatsCourier.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, couriers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createEatsCourier = async (req, res) => {
  try {
    const { name, phone, vehicleType, password } = req.body;
    if (!name || !phone || !vehicleType || !password) {
      return res.status(400).json({ success: false, message: 'Barcha maydonlar, jumladan parol to\'ldirilishi shart.' });
    }

    const newCourier = await EatsCourier.create({
      name,
      phone,
      password,
      vehicleType,
      online: false,
      status: 'idle',
      balance: 0,
      rating: 5.0
    });

    return res.status(201).json({ success: true, courier: newCourier });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateEatsCourier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, vehicleType, balance, rating, password } = req.body;

    const courier = await EatsCourier.findById(id);
    if (!courier) {
      return res.status(404).json({ success: false, message: 'Kurer topilmadi.' });
    }

    if (name !== undefined) courier.name = name;
    if (phone !== undefined) courier.phone = phone;
    if (vehicleType !== undefined) courier.vehicleType = vehicleType;
    if (balance !== undefined) courier.balance = balance;
    if (rating !== undefined) courier.rating = rating;
    if (password !== undefined) courier.password = password;

    await courier.save();
    return res.status(200).json({ success: true, courier });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEatsOrders = async (req, res) => {
  try {
    const orders = await FoodOrder.find()
      .populate('userId', 'name phone')
      .populate('restaurantId', 'name phone')
      .populate('courierId', 'name phone')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEatsAnalytics = async (req, res) => {
  try {
    const orders = await FoodOrder.find({ status: 'delivered' });
    const totalOrders = orders.length;
    const revenue = orders.reduce((sum, o) => sum + o.total, 0);

    const activeRestaurants = await Restaurant.countDocuments({ isActive: true });
    const activeCouriers = await EatsCourier.countDocuments({ online: true });

    return res.status(200).json({
      success: true,
      analytics: {
        totalOrders,
        revenue,
        activeRestaurants,
        activeCouriers
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

