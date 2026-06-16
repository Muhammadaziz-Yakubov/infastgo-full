const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: 'system_settings',
  },
  commissionPercent: {
    type: Number,
    required: true,
    default: 10,
    min: 0,
    max: 100,
  },
  warningDebtLimit: {
    type: Number,
    required: true,
    default: 50000,
    min: 0,
  },
  blockDebtLimit: {
    type: Number,
    required: true,
    default: 100000,
    min: 0,
  },
}, { timestamps: true });

module.exports = mongoose.model('Settings', SettingsSchema);
