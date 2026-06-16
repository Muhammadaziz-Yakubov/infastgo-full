const mongoose = require('mongoose');

const EatsTransactionSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodOrder',
      default: null,
      index: true,
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    ownerType: {
      type: String,
      enum: ['restaurant', 'courier', 'infast'],
      required: true,
    },
    type: {
      type: String,
      enum: [
        'restaurant_earning',
        'courier_earning',
        'service_fee',
        'withdrawal',
        'cash_settlement',
        'refund',
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    direction: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'click', 'payme', 'paynet'],
      default: 'cash',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
    description: {
      type: String,
      default: '',
    },
    // Snapshot of wallet balance after this transaction
    balanceBefore: { type: Number, default: 0 },
    balanceAfter: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EatsTransaction', EatsTransactionSchema);
