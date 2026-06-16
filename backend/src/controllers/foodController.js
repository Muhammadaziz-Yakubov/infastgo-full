const Store = require('../models/Store');
const FoodOrder = require('../models/FoodOrder');
const Courier = require('../models/Courier');
const socketService = require('../services/socketService');

// Customer Actions
exports.getStores = async (req, res) => {
  try {
    const stores = await Store.find({ isActive: true });
    return res.status(200).json({ success: true, stores });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStoreMenu = async (req, res) => {
  try {
    const store = await Store.findById(req.params.storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }
    return res.status(200).json({ success: true, menu: store.menu });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { storeId, items, deliveryAddress, subtotal, deliveryFee, total, paymentMethod } = req.body;
    const clientId = req.user._id;

    const newOrder = await FoodOrder.create({
      clientId,
      storeId,
      items,
      deliveryAddress,
      subtotal,
      deliveryFee,
      total,
      paymentMethod,
      status: 'pending'
    });

    const store = await Store.findById(storeId);
    if (store && store.ownerUserId) {
      // Notify store dashboard via socket
      const io = socketService.getIO();
      if (io) {
        io.to(store.ownerUserId.toString()).emit('new_store_order', newOrder);
      }
    }

    return res.status(201).json({ success: true, order: newOrder });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Store Dashboard Actions
exports.getStoreOrders = async (req, res) => {
  try {
    const store = await Store.findOne({ ownerUserId: req.user._id });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found for this user' });
    }
    const orders = await FoodOrder.find({ storeId: store._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, orders, store });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body; // store_accepted, preparing, ready_for_pickup, cancelled

    const order = await FoodOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = status;
    await order.save();

    const io = socketService.getIO();
    if (io) {
      // Emit to client
      io.to(order.clientId.toString()).emit('food_order_update', order);
      
      // If ready for pickup, dispatch to nearby couriers!
      if (status === 'ready_for_pickup') {
        const store = await Store.findById(order.storeId);
        const couriers = await Courier.find({ status: 'online', isOnline: true });
        
        couriers.forEach(courier => {
          io.to(courier.userId.toString()).emit('new_courier_delivery_request', {
            orderId: order._id,
            storeName: store.name,
            storeLocation: store.location,
            deliveryAddress: order.deliveryAddress,
            total: order.total
          });
        });
      }
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateMenu = async (req, res) => {
  try {
    const store = await Store.findOne({ ownerUserId: req.user._id });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    store.menu = req.body.menu;
    await store.save();

    return res.status(200).json({ success: true, menu: store.menu });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
