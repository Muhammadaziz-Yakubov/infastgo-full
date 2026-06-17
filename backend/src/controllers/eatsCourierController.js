const EatsCourier = require('../models/EatsCourier');
const FoodOrder = require('../models/FoodOrder');
const Delivery = require('../models/Delivery');
const jwt = require('jsonwebtoken');
const socketService = require('../services/socketService');

// Login for Courier App
exports.login = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Iltimos, telefon raqamini kiriting.' });
    }

    const courier = await EatsCourier.findOne({ phone });
    if (!courier) {
      return res.status(404).json({ success: false, message: 'Bunday kurer topilmadi. Hisob yaratish uchun adminga murojaat qiling.' });
    }

    const token = jwt.sign(
      { _id: courier._id, role: 'EATS_COURIER', name: courier.name },
      process.env.JWT_SECRET || 'infast_secret_key',
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      token,
      courier
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle Online/Offline Status
exports.toggleOnline = async (req, res) => {
  try {
    const courierId = req.user._id;
    const { online } = req.body;

    const courier = await EatsCourier.findById(courierId);
    if (!courier) {
      return res.status(404).json({ success: false, message: 'Kurer topilmadi.' });
    }

    courier.online = online;
    if (!online) {
      courier.status = 'idle'; // Reset status when going offline
    }
    await courier.save();

    return res.status(200).json({ success: true, courier });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update Location (Called via HTTP or Socket)
exports.updateLocation = async (req, res) => {
  try {
    const courierId = req.user._id;
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'Koordinatalar yetarli emas.' });
    }

    const courier = await EatsCourier.findById(courierId);
    if (!courier) {
      return res.status(404).json({ success: false, message: 'Kurer topilmadi.' });
    }

    courier.location = {
      type: 'Point',
      coordinates: [parseFloat(lng), parseFloat(lat)]
    };
    await courier.save();

    // Broadcast location to active users tracking order
    const io = socketService.getIO();
    if (io) {
      // Find active orders for this courier
      const activeOrders = await FoodOrder.find({
        courierId,
        status: { $in: ['picked', 'ready'] }
      });

      activeOrders.forEach(order => {
        io.to(`order_${order._id}`).emit('courier_tracking', {
          courierId,
          coordinates: [parseFloat(lng), parseFloat(lat)]
        });
      });
    }

    return res.status(200).json({ success: true, location: courier.location });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Accept Delivery Request
exports.acceptOrder = async (req, res) => {
  try {
    const courierId = req.user._id;
    const { orderId } = req.params;

    const courier = await EatsCourier.findById(courierId);
    if (!courier || !courier.online || courier.status !== 'idle') {
      return res.status(400).json({ success: false, message: 'Kurer qabul qila olmaydi yoki online emas.' });
    }

    // RACE CONDITION FIX: Atomic assignment — only one courier can accept
    const acceptableStatuses = ['accepted', 'preparing', 'ready'];
    const order = await FoodOrder.findOneAndUpdate(
      {
        _id: orderId,
        status: { $in: acceptableStatuses },
        $or: [
          { courierId: null },
          { courierId: courierId }, // Allow re-accept by same courier
        ],
      },
      {
        $set: {
          courierId: courierId,
          updatedAt: Date.now(),
        },
      },
      { new: true }
    ).populate('restaurantId');

    if (!order) {
      return res.status(400).json({ success: false, message: 'Buyurtma boshqa kurer tomonidan olindi yoki mavjud emas.' });
    }

    // Mark courier as delivering
    courier.status = 'delivering';
    await courier.save();

    // Create Delivery log
    await Delivery.create({
      orderId,
      courierId,
      distanceToRestaurant: 1500, // mock distance or calculated on frontend
      distanceToCustomer: 2500,
      earning: order.deliveryFee,
      status: 'assigned'
    });

    const io = socketService.getIO();
    if (io) {
      // Notify client that courier is assigned (maintain current status: ready/preparing)
      io.to(`order_${order._id}`).emit('order_status_changed', { orderId, status: order.status, courierId });
      io.to(`restaurant_${order.restaurantId._id}`).emit('order_status_changed', { orderId, status: order.status, courierId });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Pickup Order from Restaurant
exports.pickupOrder = async (req, res) => {
  try {
    const courierId = req.user._id;
    const { orderId } = req.params;

    const courier = await EatsCourier.findById(courierId);
    if (!courier) {
      return res.status(404).json({ success: false, message: 'Kurer topilmadi.' });
    }

    const order = await FoodOrder.findById(orderId);
    if (!order || order.courierId.toString() !== courierId.toString()) {
      return res.status(400).json({ success: false, message: 'Buyurtma sizga biriktirilmagan.' });
    }

    // Move to 'picked' status
    order.status = 'picked';
    order.updatedAt = Date.now();
    await order.save();

    // Update Delivery Log status
    const delivery = await Delivery.findOne({ orderId, courierId });
    if (delivery) {
      delivery.status = 'picked';
      await delivery.save();
    }

    const io = socketService.getIO();
    if (io) {
      io.to(`order_${order._id}`).emit('order_status_changed', { orderId, status: 'picked' });
      io.to(`restaurant_${order.restaurantId.toString()}`).emit('order_status_changed', { orderId, status: 'picked' });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Complete Delivery
exports.completeDelivery = async (req, res) => {
  try {
    const courierId = req.user._id;
    const { orderId } = req.params;

    const courier = await EatsCourier.findById(courierId);
    if (!courier) {
      return res.status(404).json({ success: false, message: 'Kurer topilmadi.' });
    }

    const order = await FoodOrder.findById(orderId);
    if (!order || order.courierId.toString() !== courierId.toString()) {
      return res.status(400).json({ success: false, message: 'Buyurtma sizga tegishli emas.' });
    }

    order.status = 'delivered';
    order.updatedAt = Date.now();
    await order.save();

    // Update Courier Status and Balance
    courier.status = 'idle';
    courier.balance += order.deliveryFee;
    await courier.save();

    // Update Delivery Log
    const delivery = await Delivery.findOne({ orderId, courierId });
    if (delivery) {
      delivery.status = 'completed';
      delivery.deliveredAt = Date.now();
      await delivery.save();
    }

    const io = socketService.getIO();
    if (io) {
      io.to(`order_${order._id}`).emit('order_status_changed', { orderId, status: 'delivered' });
      io.to(`restaurant_${order.restaurantId._id}`).emit('order_status_changed', { orderId, status: 'delivered' });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get Courier Profile & Dashboard Stats
exports.getProfile = async (req, res) => {
  try {
    const courierId = req.user._id;
    const courier = await EatsCourier.findById(courierId);
    const deliveries = await Delivery.find({ courierId, status: 'completed' });

    return res.status(200).json({
      success: true,
      courier,
      totalDeliveries: deliveries.length
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get Delivery History
exports.getHistory = async (req, res) => {
  try {
    const courierId = req.user._id;
    const deliveries = await Delivery.find({ courierId })
      .populate({
        path: 'orderId',
        populate: { path: 'restaurantId', select: 'name address' }
      })
      .sort({ deliveredAt: -1 });

    return res.status(200).json({ success: true, deliveries });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
