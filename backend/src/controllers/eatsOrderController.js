const Restaurant = require('../models/Restaurant');
const Food = require('../models/Food');
const FoodOrder = require('../models/FoodOrder');
const EatsCourier = require('../models/EatsCourier');
const Delivery = require('../models/Delivery');
const courierMatchService = require('../services/courierMatchService');
const socketService = require('../services/socketService');
const walletService = require('../services/walletService');
const { validateFoodOrderTransition } = require('../middleware/stateMachine');
const auditLog = require('../services/auditLog');

// User Screen: Get restaurants near the user (using MongoDB geospatial query)
exports.getRestaurants = async (req, res) => {
  try {
    const { lat, lng, category, search } = req.query;

    let query = { isActive: true };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    let restaurants;

    if (lat && lng) {
      // Find restaurants near user sorted by distance
      restaurants = await Restaurant.find({
        ...query,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)] // [longitude, latitude]
            },
            $maxDistance: 20000 // 20 km search radius
          }
        }
      });
    } else {
      restaurants = await Restaurant.find(query);
    }

    return res.status(200).json({ success: true, restaurants });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// User Screen: Get restaurant detail & menu
exports.getRestaurantDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restoran topilmadi.' });
    }

    const menu = await Food.find({ restaurantId: id, available: true });
    
    // Group menu items by category
    const categories = [...new Set(menu.map(item => item.category))];
    const groupedMenu = categories.map(cat => ({
      categoryName: cat,
      items: menu.filter(item => item.category === cat)
    }));

    return res.status(200).json({
      success: true,
      restaurant,
      menu: groupedMenu
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// User Screen: Create Eats Order
exports.createOrder = async (req, res) => {
  try {
    const { restaurantId, items, deliveryAddress, subtotal, deliveryFee, total, paymentMethod } = req.body;
    // User JWT uses 'id', restaurant JWT uses '_id'
    const userId = req.user.id || req.user._id;

    if (!restaurantId || !items || !items.length || !deliveryAddress) {
      return res.status(400).json({ success: false, message: 'Noloyiq buyurtma ma\'lumotlari.' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restoran topilmadi.' });
    }

    // Normalize items: CartScreen sends { foodId, name, price, quantity }
    // FoodOrder model expects { foodId, name, price, quantity }
    const normalizedItems = items.map(item => ({
      foodId: item.foodId || item._id || item.itemId || '',
      name: item.name || '',
      price: item.price || 0,
      quantity: item.quantity || 1,
    }));

    const newOrder = await FoodOrder.create({
      userId,
      restaurantId,
      items: normalizedItems,
      deliveryAddress,
      subtotal: subtotal || 0,
      deliveryFee: deliveryFee || 0,
      total: total || 0,
      paymentMethod: paymentMethod || 'cash',
      status: 'new'
    });

    // Notify the restaurant dashboard in real-time
    const io = socketService.getIO();
    if (io) {
      io.to(`restaurant_${restaurantId}`).emit('new_food_order', newOrder);
    }

    return res.status(201).json({ success: true, order: newOrder });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Restaurant & Courier: Update Order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body; // new, accepted, preparing, ready, picked, delivered, rejected

    const order = await FoodOrder.findById(id).populate('restaurantId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Buyurtma topilmadi.' });
    }

    // STATE MACHINE: Validate transition
    const transition = validateFoodOrderTransition(order.status, status);
    if (!transition.valid) {
      return res.status(400).json({ success: false, message: transition.message });
    }

    order.status = status;
    if (status === 'rejected' && rejectionReason) {
      order.rejectionReason = rejectionReason;
    }
    order.updatedAt = Date.now();
    await order.save();

    const io = socketService.getIO();
    if (io) {
      // Notify customer and restaurant about status update
      io.to(`order_${order._id}`).emit('order_status_changed', { orderId: order._id, status });
      io.to(`restaurant_${order.restaurantId._id}`).emit('order_status_changed', { orderId: order._id, status });
    }

    // ✅ WORKFLOW: Restoran qabul qilishi bilanoq (accepted) kuryer chaqiriladi
    // Kuryer restoranga boradi, u yerda ovqat tayyorlanishini kutadi
    if (status === 'accepted') {
      const restaurantCoords = order.restaurantId.location.coordinates;
      const bestCourier = await courierMatchService.findBestCourier(restaurantCoords);

      if (bestCourier && io) {
        const courierLng = bestCourier.location?.coordinates?.[0];
        const courierLat = bestCourier.location?.coordinates?.[1];
        const restLng = order.restaurantId.location.coordinates[0];
        const restLat = order.restaurantId.location.coordinates[1];
        const custLat = order.deliveryAddress?.lat;
        const custLng = order.deliveryAddress?.lng;

        const toRad = (v) => (v * Math.PI) / 180;
        const haversine = (lat1, lng1, lat2, lng2) => {
          if (!lat1 || !lng1 || !lat2 || !lng2) return null;
          const R = 6371000;
          const dLat = toRad(lat2 - lat1);
          const dLng = toRad(lng2 - lng1);
          const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
          return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
        };

        const distToRestaurant = haversine(courierLat, courierLng, restLat, restLng);
        const distToCustomer = haversine(restLat, restLng, custLat, custLng);

        console.log(`[CourierDispatch] Sending delivery request to courier ${bestCourier._id} for order ${order._id}`);

        io.to(`courier_${bestCourier._id}`).emit('new_delivery_request', {
          orderId: order._id,
          restaurantName: order.restaurantId.name,
          restaurantAddress: order.restaurantId.address,
          restaurantCoords: { lat: restLat, lng: restLng },
          deliveryAddress: order.deliveryAddress,
          deliveryFee: order.deliveryFee,
          total: order.total,
          items: order.items,
          distToRestaurant,
          distToCustomer,
          orderStatus: 'accepted', // food is being prepared
        });
      } else {
        console.log(`[CourierDispatch] No available courier found for order ${order._id}`);
      }
    }

    // ✅ AUTO WALLET SETTLEMENT: Yetkazilganda pul avtomatik taqsimlanadi
    if (status === 'delivered') {
      try {
        const populatedOrder = await FoodOrder.findById(id)
          .populate('restaurantId', 'name')
          .populate('courierId', 'name');
        await walletService.settleOrder(populatedOrder);
      } catch (settleErr) {
        console.error('[OrderController] Wallet settlement error:', settleErr.message);
        // Don't fail the status update if settlement fails — log and continue
      }
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// User Screen: Track active order status & courier coordinates
exports.trackOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user._id;

    const order = await FoodOrder.findById(id)
      .populate('restaurantId', 'name phone address location')
      .populate('courierId', 'name phone vehicleType location rating');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Buyurtma topilmadi.' });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// User Screen: Get User Food Order History
exports.getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const orders = await FoodOrder.find({ userId })
      .populate('restaurantId', 'name image address')
      .populate('courierId', 'name phone vehicleType rating')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// User Screen: Rate delivered order
exports.rateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id || req.user._id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Baho 1 dan 5 gacha bo\'lishi kerak.' });
    }

    const order = await FoodOrder.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Buyurtma topilmadi.' });
    }

    if (order.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Ruxsat yo\'q.' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Faqat yetkazilgan buyurtmalarni baholash mumkin.' });
    }

    if (order.isRated) {
      return res.status(400).json({ success: false, message: 'Bu buyurtma allaqachon baholangan.' });
    }

    order.rating = rating;
    order.ratingComment = comment || '';
    order.isRated = true;
    await order.save();

    // Update restaurant average rating
    const allRated = await FoodOrder.find({
      restaurantId: order.restaurantId,
      isRated: true,
      rating: { $ne: null }
    });

    if (allRated.length > 0) {
      const avgRating = allRated.reduce((sum, o) => sum + o.rating, 0) / allRated.length;
      await Restaurant.findByIdAndUpdate(order.restaurantId, {
        rating: Math.round(avgRating * 10) / 10
      });
    }

    return res.status(200).json({ success: true, message: 'Rahmat! Bahoyingiz qabul qilindi.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
