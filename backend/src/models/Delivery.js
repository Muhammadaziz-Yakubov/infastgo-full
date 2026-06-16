const mongoose = require('mongoose');

const DeliverySchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOrder', required: true },
  courierId: { type: mongoose.Schema.Types.ObjectId, ref: 'EatsCourier', required: true },
  distanceToRestaurant: { type: Number, required: true }, // in meters
  distanceToCustomer: { type: Number, required: true }, // in meters
  earning: { type: Number, required: true }, // Courier's net pay
  pickedAt: { type: Date },
  deliveredAt: { type: Date },
  status: { type: String, enum: ['assigned', 'picked', 'completed'], default: 'assigned' }
});

module.exports = mongoose.model('Delivery', DeliverySchema);
