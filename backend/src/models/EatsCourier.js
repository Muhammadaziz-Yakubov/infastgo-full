const mongoose = require('mongoose');

const EatsCourierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true, default: '123456' },
  vehicleType: { type: String, enum: ['walking', 'bicycle', 'scooter', 'car'], required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [69.2401, 41.2995] } // [lng, lat]
  },
  online: { type: Boolean, default: false },
  rating: { type: Number, default: 5.0 },
  balance: { type: Number, default: 0 },
  status: { type: String, enum: ['idle', 'delivering'], default: 'idle' },
  createdAt: { type: Date, default: Date.now }
});

EatsCourierSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('EatsCourier', EatsCourierSchema);
