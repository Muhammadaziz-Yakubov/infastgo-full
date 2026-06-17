const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const EatsCourierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
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

// Hash password before saving
EatsCourierSchema.pre('save', async function (next) {
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
EatsCourierSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

EatsCourierSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('EatsCourier', EatsCourierSchema);
