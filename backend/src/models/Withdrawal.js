const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema(
  {
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    ownerType: {
      type: String,
      enum: ['restaurant', 'courier'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 10000, // minimum 10,000 UZS withdrawal
    },
    cardNumber: {
      type: String,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['click', 'payme', 'paynet'],
      default: 'click',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending',
    },
    adminNote: {
      type: String,
      default: '',
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);
