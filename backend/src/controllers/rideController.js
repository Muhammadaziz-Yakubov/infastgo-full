const Ride = require('../models/Ride');
const Driver = require('../models/Driver');
const User = require('../models/User');
const Config = require('../models/Config');
const PromoCode = require('../models/PromoCode');
const matchService = require('../services/matchService');
const socketService = require('../services/socketService');
const Transaction = require('../models/Transaction');
const { getSettings } = require('../services/settingsService');
const { validateRideTransition } = require('../middleware/stateMachine');
const auditLog = require('../services/auditLog');

const createClickPaymentUrl = (ride) => {
  const serviceId = process.env.CLICK_SERVICE_ID || '101737';
  const merchantId = process.env.CLICK_MERCHANT_ID || '60286';

  const amount = Math.round(ride.price);
  const transactionParam = `ride_${ride._id.toString()}`;
  return `https://my.click.uz/services/pay?service_id=${serviceId}&merchant_id=${merchantId}&amount=${amount}&transaction_param=${transactionParam}`;
};

// Get current active pricing configuration
const getPricingConfig = async () => {
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
  return config;
};

// Estimate Ride Fare
exports.estimateFare = async (req, res) => {
  try {
    const { distance } = req.body; // in km

    if (distance === undefined || distance === null) {
      return res.status(400).json({ success: false, message: 'Masofa ko\'rsatilishi shart' });
    }

    const config = await getPricingConfig();
    const estimates = {};
    const tariffsList = ['standart', 'komfort', 'biznes'];

    for (const t of tariffsList) {
      const tConfig = (config.tariffs && config.tariffs[t]) || { baseFare: 5000, pricePerKm: 1500 };
      estimates[t] = Math.round(
        (tConfig.baseFare + distance * tConfig.pricePerKm) * config.surgeMultiplier
      );
    }

    return res.status(200).json({
      success: true,
      distance,
      estimates,
      surgeMultiplier: config.surgeMultiplier,
    });
  } catch (error) {
    console.error('Estimate fare error:', error);
    return res.status(500).json({ success: false, message: 'Narxni hisoblashda xatolik yuz berdi' });
  }
};

// Request a Ride
exports.requestRide = async (req, res) => {
  try {
    const { pickup, destination, distance, price, tariff, options, paymentMethod, promoCode, routeGeometry } = req.body;
    const userId = req.user.id;

    if (!pickup || !destination || !distance || !price) {
      return res.status(400).json({ success: false, message: 'Barcha ma\'lumotlar kiritilishi shart' });
    }

    const validTariffs = ['standart', 'komfort', 'biznes'];
    const chosenTariff = (tariff && validTariffs.includes(tariff)) ? tariff : 'standart';
    const chosenPaymentMethod = paymentMethod === 'click' ? 'click' : 'cash';

    // Check if user already has an active ride
    const existingActiveRide = await Ride.findOne({
      userId,
      status: { $in: ['payment_pending', 'searching', 'accepted', 'arriving', 'started'] },
    });

    if (existingActiveRide) {
      return res.status(400).json({
        success: false,
        message: 'Sizda allaqachon faol buyurtma mavjud',
        ride: existingActiveRide,
      });
    }

    // Apply promo code discount if provided
    let finalPrice = price;
    let appliedPromo = null;
    if (promoCode) {
      const promo = await PromoCode.findOne({
        code: promoCode.trim().toUpperCase(),
        isActive: true,
      });

      if (promo) {
        const now = new Date();
        const isNotExpired = !promo.expiresAt || now <= promo.expiresAt;
        const hasUses = promo.usedCount < promo.maxUses;
        const validService = promo.service === 'all' || promo.service === 'taxi';

        if (isNotExpired && hasUses && validService) {
          const discountAmount = Math.round(finalPrice * (promo.discount / 100));
          finalPrice = finalPrice - discountAmount;
          appliedPromo = { code: promo.code, discount: promo.discount, discountAmount };

          // Increment usage count
          promo.usedCount += 1;
          await promo.save();
        }
      }
    }

    // Create ride record
    const ride = await Ride.create({
      userId,
      pickup,
      destination,
      distance,
      price: finalPrice,
      originalPrice: price,
      promoCode: appliedPromo ? appliedPromo.code : null,
      discountApplied: appliedPromo ? appliedPromo.discount : 0,
      tariff: chosenTariff,
      status: chosenPaymentMethod === 'click' ? 'payment_pending' : 'searching',
      options: options || { ac: false, luggage: false },
      routeGeometry: routeGeometry || { type: 'LineString', coordinates: [] },
      paymentMethod: chosenPaymentMethod,
      paymentStatus: chosenPaymentMethod === 'click' ? 'pending' : 'unpaid',
    });

    const paymentUrl = chosenPaymentMethod === 'click' ? createClickPaymentUrl(ride) : null;

    if (chosenPaymentMethod === 'click' && !paymentUrl) {
      ride.status = 'cancelled';
      ride.paymentStatus = 'failed';
      await ride.save();
      return res.status(500).json({
        success: false,
        message: 'Click to\'lov sozlamalari topilmadi',
      });
    }

    if (chosenPaymentMethod === 'cash') {
      dispatchRide(ride._id.toString());
    }

    return res.status(201).json({
      success: true,
      message: chosenPaymentMethod === 'click' ? 'Avval Click orqali to\'lovni yakunlang' : 'Haydovchi qidirilmoqda...',
      ride,
      paymentUrl,
      promoApplied: appliedPromo,
    });
  } catch (error) {
    console.error('Request ride error:', error);
    return res.status(500).json({ success: false, message: 'Buyurtma yaratishda xatolik' });
  }
};

// The Ride dispatching loop
const dispatchRide = async (rideId, excludeDriverIds = []) => {
  try {
    const ride = await Ride.findById(rideId).populate('userId');
    if (!ride || ride.status !== 'searching') return;

    // Find nearest driver matching the requested tariff
    const driver = await matchService.findNearestDriver(
      ride.pickup.lat,
      ride.pickup.lng,
      excludeDriverIds,
      ride.tariff
    );

    if (!driver) {
      console.log(`[Dispatch] No driver found for ride ${rideId}`);
      ride.status = 'cancelled';
      await ride.save();

      // Notify user via Socket
      socketService.sendToUser(ride.userId._id.toString(), 'rideStatusUpdate', {
        status: 'cancelled',
        message: 'Afsuski, yaqin orada bo\'sh haydovchilar topilmadi',
      });
      return;
    }

    console.log(`[Dispatch] Offering ride ${rideId} to driver ${driver.name} (${driver._id})`);

    // Temporarily associate driver to hold the request
    ride.driverId = driver._id;
    await ride.save();

    // Send socket event to driver
    const success = socketService.sendToDriver(driver._id.toString(), 'rideRequest', {
      rideId: ride._id,
      pickup: ride.pickup,
      destination: ride.destination,
      price: ride.price,
      distance: ride.distance,
      tariff: ride.tariff,
      options: ride.options || { ac: false, luggage: false },
      paymentMethod: ride.paymentMethod,
      paymentStatus: ride.paymentStatus,
      // NOTE: user name/phone intentionally hidden until driver accepts
      user: {
        name: 'Yo\'lovchi',
        phone: null,
      },
    });

    if (!success) {
      // Driver socket not connected or offline, retry with different driver
      console.log(`[Dispatch] Driver ${driver._id} socket not active. Retrying...`);
      excludeDriverIds.push(driver._id.toString());
      dispatchRide(rideId, excludeDriverIds);
      return;
    }

    // Set a timeout of 30 seconds for driver to accept.
    // If they don't accept, we consider it a rejection.
    setTimeout(async () => {
      try {
        const checkRide = await Ride.findById(rideId);
        // If the ride is still searching/assigned to this driver and they haven't accepted
        if (checkRide && checkRide.status === 'searching' && checkRide.driverId.toString() === driver._id.toString()) {
          console.log(`[Dispatch] Driver ${driver._id} request timed out for ride ${rideId}`);
          
          // Re-add driver to exclusions
          excludeDriverIds.push(driver._id.toString());
          
          checkRide.driverId = null;
          await checkRide.save();

          // Notify driver that the offer has timed out so the frontend removes the screen
          socketService.sendToDriver(driver._id.toString(), 'rideOfferTimeout', { rideId });
          
          // Retry matching
          dispatchRide(rideId, excludeDriverIds);
        }
      } catch (err) {
        console.error('Error in dispatch timeout callback:', err);
      }
    }, 15000);

  } catch (error) {
    console.error('Error in dispatchRide loop:', error);
  }
};

exports.dispatchRide = dispatchRide;

// Accept Ride (Driver Endpoint)
exports.acceptRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;

    const driver = await Driver.findById(driverId);
    if (!driver || driver.status !== 'online') {
      return res.status(400).json({ success: false, message: 'Siz hozir buyurtma qabul qila olmaysiz. Tizimda online bo\'ling.' });
    }

    if (driver.isBlocked === true) {
      return res.status(400).json({ success: false, message: 'Qarzdorlik limiti oshib ketgan. Qarzni to\'lang.' });
    }

    // RACE CONDITION FIX: Atomic update — only one driver can accept
    // findOneAndUpdate with status: 'searching' ensures no two drivers can accept the same ride
    const ride = await Ride.findOneAndUpdate(
      { _id: rideId, status: 'searching' },
      {
        $set: {
          status: 'accepted',
          driverId: driverId,
          acceptedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!ride) {
      return res.status(400).json({ success: false, message: 'Ushbu buyurtma allaqachon qabul qilingan yoki bekor qilingan' });
    }

    await ride.populate('userId', 'name surname phone');

    // Update driver status
    driver.status = 'busy';
    await driver.save();

    // Audit log
    await auditLog.log({
      action: 'ride.accepted',
      actor: { id: driverId, role: 'driver' },
      target: { type: 'ride', id: rideId },
    });

    // Notify user
    socketService.sendToUser(ride.userId._id.toString(), 'rideStatusUpdate', {
      rideId: ride._id,
      status: 'accepted',
      driver: {
        id: driver._id,
        name: driver.name,
        surname: driver.surname,
        phone: driver.phone,
        carInfo: driver.carInfo,
        rating: driver.rating,
      },
    });

    // Notify Admins
    socketService.broadcastToAdmins('rideUpdate', ride);

    return res.status(200).json({ success: true, message: 'Buyurtma muvaffaqiyatli qabul qilindi', ride });
  } catch (error) {
    console.error('Accept ride error:', error);
    return res.status(500).json({ success: false, message: 'Buyurtmani qabul qilishda xatolik' });
  }
};

// Reject Ride (Driver Endpoint)
exports.rejectRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });
    }

    if (ride.status !== 'searching' || !ride.driverId || ride.driverId.toString() !== driverId) {
      return res.status(400).json({ success: false, message: 'Ushbu amalni bajarish imkonsiz' });
    }

    console.log(`[Controller] Driver ${driverId} rejected ride ${rideId}`);
    
    // Clear targeted driver
    ride.driverId = null;
    await ride.save();

    // Trigger match for next closest driver, excluding the current one
    dispatchRide(rideId, [driverId]);

    return res.status(200).json({ success: true, message: 'Buyurtma rad etildi' });
  } catch (error) {
    console.error('Reject ride error:', error);
    return res.status(500).json({ success: false, message: 'Buyurtmani rad etishda xatolik' });
  }
};

// Update Ride Status (Driver controls arriving, started, completed transitions)
exports.updateRideStatus = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body; // 'arriving', 'started', 'completed'
    const driverId = req.user.id;

    const validStatuses = ['arriving', 'started', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Noto\'g\'ri buyurtma holati' });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });
    }

    if (ride.driverId.toString() !== driverId) {
      return res.status(403).json({ success: false, message: 'Ushbu buyurtmani boshqarish huquqiga ega emassiz' });
    }

    // STATE MACHINE: Validate transition
    const transition = validateRideTransition(ride.status, status);
    if (!transition.valid) {
      return res.status(400).json({ success: false, message: transition.message });
    }

    ride.status = status;
    if (status === 'started') {
      ride.startedAt = new Date();
    } else if (status === 'completed') {
      ride.completedAt = new Date();
      
      const settings = await getSettings();
      const fare = ride.price;
      const commission = Math.round(fare * (settings.commissionPercent / 100));
      const driverAmount = fare - commission;
      
      const driver = await Driver.findById(driverId);
      if (driver) {
        const balanceBefore = driver.balance || 0;
        driver.balance = balanceBefore - commission;
        driver.pendingCommission = Math.abs(driver.balance);
        driver.totalCommission = (driver.totalCommission || 0) + commission;
        driver.earnings += driverAmount;
        
        const debt = Math.abs(driver.balance);
        if (debt >= settings.blockDebtLimit) {
          driver.isBlocked = true;
          driver.status = 'offline';
        } else {
          driver.isBlocked = false;
          driver.status = 'online';
        }
        await driver.save();

        // Save a Transaction for deduction
        await Transaction.create({
          driverId: driver._id,
          type: 'commission_deduct',
          amount: commission,
          balanceBefore,
          balanceAfter: driver.balance,
          rideId: ride._id,
          status: 'completed',
          description: `Buyurtma komissiyasi (#${ride._id.toString().slice(-6)})`,
        });
      }

      ride.commissionPercent = settings.commissionPercent;
      ride.commissionAmount = commission;
      ride.driverEarnings = driverAmount;
    }

    await ride.save();
    await ride.populate('userId', 'name surname phone');

    // Notify User
    socketService.sendToUser(ride.userId._id.toString(), 'rideStatusUpdate', {
      rideId: ride._id,
      status: ride.status,
    });

    // Notify Admins
    socketService.broadcastToAdmins('rideUpdate', ride);

    return res.status(200).json({
      success: true,
      message: `Buyurtma holati "${status}" ga o'zgartirildi`,
      ride,
    });
  } catch (error) {
    console.error('Update ride status error:', error);
    return res.status(500).json({ success: false, message: 'Buyurtma holatini yangilashda xatolik' });
  }
};

// Rate Driver (User Endpoint)
exports.rateDriver = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { rating } = req.body; // Number 1-5
    const userId = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Reyting 1 va 5 oralig\'ida bo\'lishi kerak' });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });
    }

    if (ride.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Ruxsat etilmagan foydalanuvchi' });
    }

    if (ride.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Faqat yakunlangan sayohatlarni baholash mumkin' });
    }

    if (ride.rating > 0) {
      return res.status(400).json({ success: false, message: 'Ushbu sayohat allaqachon baholangan' });
    }

    ride.rating = rating;
    await ride.save();

    // Recalculate Driver rating
    const driver = await Driver.findById(ride.driverId);
    if (driver) {
      const currentSum = driver.rating * driver.totalRatings;
      driver.totalRatings += 1;
      driver.rating = parseFloat(((currentSum + rating) / driver.totalRatings).toFixed(2));
      await driver.save();
    }

    return res.status(200).json({ success: true, message: 'Baholash uchun rahmat' });
  } catch (error) {
    console.error('Rate driver error:', error);
    return res.status(500).json({ success: false, message: 'Baholashda xatolik yuz berdi' });
  }
};

// Get Ride History
exports.getRideHistory = async (req, res) => {
  try {
    const { id, role } = req.user;
    let rides;

    if (role === 'driver') {
      rides = await Ride.find({ driverId: id })
        .populate('userId', 'name surname phone')
        .sort({ createdAt: -1 });
    } else {
      rides = await Ride.find({ userId: id })
        .populate('driverId', 'name surname phone carInfo')
        .sort({ createdAt: -1 });
    }

    return res.status(200).json({ success: true, rides });
  } catch (error) {
    console.error('Get history error:', error);
    return res.status(500).json({ success: false, message: 'Tarixni yuklashda xatolik' });
  }
};

// Get Current Active Ride
exports.getActiveRide = async (req, res) => {
  try {
    const { id, role } = req.user;
    let query = {
      status: { $in: ['payment_pending', 'searching', 'accepted', 'arriving', 'started'] },
    };

    if (role === 'driver') {
      query.driverId = id;
    } else {
      query.userId = id;
    }

    const ride = await Ride.findOne(query)
      .populate('userId', 'name surname phone')
      .populate('driverId', 'name surname phone carInfo currentLocation');

    if (!ride) {
      return res.status(200).json({ success: true, ride: null });
    }

    const rideObj = ride.toObject();
    if (rideObj.paymentMethod === 'click' && rideObj.status === 'payment_pending') {
      rideObj.paymentUrl = createClickPaymentUrl(rideObj);
    }
    return res.status(200).json({ success: true, ride: rideObj });
  } catch (error) {
    console.error('Get active ride error:', error);
    return res.status(500).json({ success: false, message: 'Faol sayohatni yuklashda xatolik' });
  }
};

// Cancel Ride (User or Driver Endpoint)
exports.cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { id, role } = req.user;

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });
    }

    // Authorization: Must be either the client or the assigned driver
    const isUser = ride.userId.toString() === id;
    const isDriver = ride.driverId && ride.driverId.toString() === id;

    if (!isUser && !isDriver) {
      return res.status(403).json({ success: false, message: 'Ushbu buyurtmani bekor qilish huquqiga ega emassiz' });
    }

    if (ride.status === 'cancelled') {
      return res.status(200).json({ success: true, message: 'Buyurtma allaqachon bekor qilingan' });
    }

    if (ride.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Ushbu buyurtmani bekor qilib bo\'lmaydi' });
    }

    ride.status = 'cancelled';
    await ride.save();

    // Release driver if one was assigned
    if (ride.driverId) {
      const driver = await Driver.findById(ride.driverId);
      if (driver) {
        // If not blocked, set back to online
        if (driver.isBlocked !== true) {
          driver.status = 'online';
        } else {
          driver.status = 'offline';
        }
        await driver.save();
      }
    }

    // Notify user via Socket
    socketService.sendToUser(ride.userId.toString(), 'rideStatusUpdate', {
      rideId: ride._id,
      status: 'cancelled',
      cancelledBy: role,
    });

    // Notify driver via Socket if driver exists
    if (ride.driverId) {
      socketService.sendToDriver(ride.driverId.toString(), 'rideStatusUpdate', {
        rideId: ride._id,
        status: 'cancelled',
        cancelledBy: role,
      });
    }

    // Notify Admins
    socketService.broadcastToAdmins('rideUpdate', ride);

    return res.status(200).json({ success: true, message: 'Buyurtma muvaffaqiyatli bekor qilindi' });
  } catch (error) {
    console.error('Cancel ride error:', error);
    return res.status(500).json({ success: false, message: 'Buyurtmani bekor qilishda xatolik' });
  }
};

