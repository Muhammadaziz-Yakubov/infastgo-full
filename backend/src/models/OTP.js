const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  code: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '5m' }, // Auto delete after 5 minutes
  },
});

module.exports = mongoose.model('OTP', OTPSchema);
