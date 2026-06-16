const mongoose = require('mongoose');

const FoodOrderItemSchema = new mongoose.Schema({
  foodId: { type: String, required: true },   // sent from RestaurantDetailScreen as 'foodId'
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
});

const FoodOrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    courierId: { type: mongoose.Schema.Types.ObjectId, ref: 'EatsCourier', default: null },
    items: [FoodOrderItemSchema],
    deliveryAddress: {
      address: { type: String, required: true },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    subtotal: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['cash', 'click'], default: 'cash' },
    status: {
      type: String,
      enum: [
        'new',
        'pending',
        'accepted',
        'preparing',
        'ready',
        'picked',
        'delivered',
        'rejected',
        'cancelled',
      ],
      default: 'new',
    },
    rejectionReason: { type: String, default: '' },
    rating: { type: Number, min: 1, max: 5, default: null },
    ratingComment: { type: String, default: '' },
    isRated: { type: Boolean, default: false },
    isSettled: { type: Boolean, default: false }, // wallet settlement done
  },
  { timestamps: true }
);

module.exports = mongoose.model('FoodOrder', FoodOrderSchema);
