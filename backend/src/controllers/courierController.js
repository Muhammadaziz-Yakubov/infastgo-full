const Courier = require('../models/Courier');
const FoodOrder = require('../models/FoodOrder');
const Store = require('../models/Store');
const socketService = require('../services/socketService');

exports.getCourierProfile = async (req, res) => {
  try {
    let courier = await Courier.findOne({ userId: req.user._id });
    if (!courier) {
      // Auto-create courier profile if user wants to enter courier mode
      courier = await Courier.create({
        userId: req.user._id,
        phone: req.user.phone,
        name: req.user.name || 'Kuryer',
        surname: req.user.surname || '',
        vehicleType: 'bicycle',
        status: 'offline',
        isOnline: false,
      });
    }
    return res.status(200).json({ success: true, courier });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    const courier = await Courier.findOne({ userId: req.user._id });
    if (!courier) {
      return res.status(404).json({ success: false, message: 'Courier profile not found' });
    }

    courier.isOnline = !courier.isOnline;
    courier.status = courier.isOnline ? 'online' : 'offline';
    await courier.save();

    return res.status(200).json({ success: true, courier });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.acceptDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const courier = await Courier.findOne({ userId: req.user._id });
    
    if (!courier || !courier.isOnline) {
      return res.status(400).json({ success: false, message: 'Courier is offline or not found' });
    }

    const order = await FoodOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.courierId) {
      return res.status(400).json({ success: false, message: 'Order already accepted by another courier' });
    }

    order.courierId = courier._id;
    order.status = 'courier_picked_up'; // Let's set it to picked up or courier assigned
    await order.save();

    courier.status = 'busy';
    await courier.save();

    const io = socketService.getIO();
    if (io) {
      io.to(order.clientId.toString()).emit('food_order_update', order);
      const store = await Store.findById(order.storeId);
      if (store) {
        io.to(store.ownerUserId.toString()).emit('store_order_update', order);
      }
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const courier = await Courier.findOne({ userId: req.user._id });
    
    const order = await FoodOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = 'delivered';
    await order.save();

    if (courier) {
      courier.status = 'online';
      courier.balance += order.deliveryFee;
      await courier.save();
    }

    const io = socketService.getIO();
    if (io) {
      io.to(order.clientId.toString()).emit('food_order_update', order);
      const store = await Store.findById(order.storeId);
      if (store) {
        io.to(store.ownerUserId.toString()).emit('store_order_update', order);
      }
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
