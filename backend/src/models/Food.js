const mongoose = require('mongoose');

const FoodSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  available: { type: Boolean, default: true }
});

FoodSchema.index({ restaurantId: 1, category: 1 });
module.exports = mongoose.model('Food', FoodSchema);
