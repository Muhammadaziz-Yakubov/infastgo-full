const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const RestaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  login: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  category: { type: String, enum: ['Fast Food', 'National Food', 'Desserts', 'Drinks'], required: true },
  rating: { type: Number, default: 5.0 },
  isActive: { type: Boolean, default: true },
  deliveryPrice: { type: Number, default: 10000 },
  estimatedDeliveryTime: { type: Number, default: 30 },
  image: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
RestaurantSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
RestaurantSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

RestaurantSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Restaurant', RestaurantSchema);
