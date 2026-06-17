const Restaurant = require('../models/Restaurant');
const Food = require('../models/Food');
const FoodOrder = require('../models/FoodOrder');
const jwt = require('jsonwebtoken');
const socketService = require('../services/socketService');

// Login for Restaurant Panel
exports.login = async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ success: false, message: 'Iltimos, login va parolni kiriting.' });
    }

    const restaurant = await Restaurant.findOne({ login });
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restoran topilmadi.' });
    }

    // Secure password comparison using bcrypt
    const isMatch = await restaurant.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Noto\'g\'ri parol.' });
    }

    if (!restaurant.isActive) {
      return res.status(403).json({ success: false, message: 'Restoran hisobi bloklangan.' });
    }

    const token = jwt.sign(
      { _id: restaurant._id, role: 'RESTAURANT', name: restaurant.name },
      process.env.JWT_SECRET || 'infast_secret_key',
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      token,
      restaurant: {
        _id: restaurant._id,
        name: restaurant.name,
        phone: restaurant.phone,
        address: restaurant.address,
        category: restaurant.category,
        rating: restaurant.rating,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const restaurantId = req.user._id;
    const today = new Date();
    today.setHours(0,0,0,0);

    const orders = await FoodOrder.find({ restaurantId });

    const todayOrders = orders.filter(o => o.createdAt >= today);
    const revenue = todayOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + o.subtotal, 0);

    const completed = orders.filter(o => o.status === 'delivered').length;
    const active = orders.filter(o => ['new', 'accepted', 'preparing', 'ready', 'picked'].includes(o.status)).length;

    return res.status(200).json({
      success: true,
      stats: {
        todayOrdersCount: todayOrders.length,
        revenue,
        completedCount: completed,
        activeCount: active,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Manage Menu (CRUD)
exports.getMenu = async (req, res) => {
  try {
    const restaurantId = req.user._id;
    const foods = await Food.find({ restaurantId });
    return res.status(200).json({ success: true, menu: foods });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.addMenuItem = async (req, res) => {
  try {
    const restaurantId = req.user._id;
    const { name, description, price, category, image, available } = req.body;

    const newFood = await Food.create({
      restaurantId,
      name,
      description,
      price,
      category,
      image: image || '',
      available: available !== undefined ? available : true
    });

    return res.status(201).json({ success: true, food: newFood });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const restaurantId = req.user._id;
    const { id } = req.params;
    const { name, description, price, category, image, available } = req.body;

    const food = await Food.findOne({ _id: id, restaurantId });
    if (!food) {
      return res.status(404).json({ success: false, message: 'Taom topilmadi yoki sizga tegishli emas.' });
    }

    if (name !== undefined) food.name = name;
    if (description !== undefined) food.description = description;
    if (price !== undefined) food.price = price;
    if (category !== undefined) food.category = category;
    if (image !== undefined) food.image = image;
    if (available !== undefined) food.available = available;

    await food.save();
    return res.status(200).json({ success: true, food });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const restaurantId = req.user._id;
    const { id } = req.params;

    const result = await Food.deleteOne({ _id: id, restaurantId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Taom topilmadi.' });
    }

    return res.status(200).json({ success: true, message: 'Taom muvaffaqiyatli o\'chirildi.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Order management
exports.getOrders = async (req, res) => {
  try {
    const restaurantId = req.user._id;
    const orders = await FoodOrder.find({ restaurantId })
      .populate('userId', 'name phone')
      .populate('courierId', 'name phone')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
