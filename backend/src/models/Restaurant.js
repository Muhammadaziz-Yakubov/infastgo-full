const mongoose = require('mongoose');

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

RestaurantSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Restaurant', RestaurantSchema);
