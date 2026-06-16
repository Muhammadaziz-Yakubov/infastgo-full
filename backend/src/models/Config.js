const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'pricing',
  },
  tariffs: {
    standart: {
      baseFare: { type: Number, default: 5000 },
      pricePerKm: { type: Number, default: 1500 },
    },
    komfort: {
      baseFare: { type: Number, default: 7000 },
      pricePerKm: { type: Number, default: 2000 },
    },
    biznes: {
      baseFare: { type: Number, default: 10000 },
      pricePerKm: { type: Number, default: 3000 },
    },
  },
  surgeMultiplier: {
    type: Number,
    required: true,
    default: 1.0,
  },
  commissionPercent: {
    type: Number,
    default: 10,
    min: 0,
    max: 100,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Config', ConfigSchema);
