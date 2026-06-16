const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
  driverId: {
    type: Number,
    unique: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
  },
  surname: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    default: 'driver',
  },
  status: {
    type: String,
    enum: ['offline', 'online', 'busy'],
    default: 'offline',
  },
  carInfo: {
    make: { type: String, required: true },
    model: { type: String, required: true },
    color: { type: String, required: true },
    plateNumber: { type: String, required: true },
  },
  rating: {
    type: Number,
    default: 5.0,
  },
  totalRatings: {
    type: Number,
    default: 0,
  },
  earnings: {
    type: Number,
    default: 0,
  },
  balance: {
    type: Number,
    default: 0,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  totalCommission: {
    type: Number,
    default: 0,
  },
  pendingCommission: {
    type: Number,
    default: 0,
  },
  totalCommissionPaid: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  currentLocation: {
    lat: { type: Number, default: 41.311081 }, // Default Tashkent coordinates
    lng: { type: Number, default: 69.240562 },
    updatedAt: { type: Date, default: Date.now },
  },
  tariffs: {
    type: [String],
    enum: ['standart', 'komfort', 'biznes'],
    default: ['standart'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Auto-assign driverId before saving
DriverSchema.pre('save', async function (next) {
  if (this.isNew && !this.driverId) {
    const lastDriver = await mongoose.model('Driver').findOne().sort({ driverId: -1 });
    let nextId = 1000;
    if (lastDriver && lastDriver.driverId) {
      nextId = Math.max(lastDriver.driverId + 1, 1000);
    }
    this.driverId = nextId;
  }
  next();
});

module.exports = mongoose.model('Driver', DriverSchema);
