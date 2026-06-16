const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.Mixed, // ObjectId for restaurant/courier, 'infast' string
      required: true,
      index: true,
    },
    ownerType: {
      type: String,
      enum: ['restaurant', 'courier', 'infast'],
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    pendingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarned: {
      type: Number,
      default: 0,
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
    },
    // Only for couriers: cash collected from customers (debt to platform)
    cashDebt: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Compound unique index: one wallet per owner
WalletSchema.index({ ownerId: 1, ownerType: 1 }, { unique: true });

module.exports = mongoose.model('Wallet', WalletSchema);
