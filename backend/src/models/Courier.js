const mongoose = require('mongoose');

const CourierSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  phone: { type: String, required: true },
  name: { type: String, required: true },
  surname: { type: String, required: true },
  isOnline: { type: Boolean, default: false },
  status: { type: String, enum: ['offline', 'online', 'busy'], default: 'offline' },
  vehicleType: { type: String, enum: ['bicycle', 'scooter', 'car', 'foot'], default: 'bicycle' },
  currentLocation: {
    lat: { type: Number, default: 41.311081 },
    lng: { type: Number, default: 69.240562 },
    updatedAt: { type: Date, default: Date.now },
  },
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Courier', CourierSchema);
