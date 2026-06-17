const mongoose = require('mongoose');

const RideSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null,
  },
  excludedDrivers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: [],
  }],
  pickup: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String, required: true },
  },
  destination: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String, required: true },
  },
  status: {
    type: String,
    enum: ['payment_pending', 'searching', 'accepted', 'arriving', 'started', 'completed', 'cancelled'],
    default: 'searching',
  },
  price: {
    type: Number,
    required: true,
  },
  tariff: {
    type: String,
    enum: ['standart', 'komfort', 'biznes'],
    default: 'standart',
  },
  distance: {
    type: Number,
    required: true, // in km
  },
  options: {
    ac: { type: Boolean, default: false },
    luggage: { type: Boolean, default: false },
  },
  routeGeometry: {
    type: { type: String, enum: ['LineString'], default: 'LineString' },
    coordinates: { type: [[Number]], default: [] }
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'click'],
    default: 'cash',
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'pending', 'paid', 'failed'],
    default: 'unpaid',
  },
  clickTransactionId: {
    type: String,
    default: null,
  },
  paidAt: Date,
  rating: {
    type: Number,
    default: 0,
  },
  commissionPercent: {
    type: Number,
    default: 0,
  },
  commissionAmount: {
    type: Number,
    default: 0,
  },
  driverEarnings: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  acceptedAt: Date,
  startedAt: Date,
  completedAt: Date,
});

module.exports = mongoose.model('Ride', RideSchema);
