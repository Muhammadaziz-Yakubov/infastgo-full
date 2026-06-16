/**
 * walletService.js
 * Central service for all wallet operations.
 * RULE: Never update balance directly — always create EatsTransaction.
 */

const Wallet = require('../models/Wallet');
const EatsTransaction = require('../models/EatsTransaction');
const FoodOrder = require('../models/FoodOrder');

const INFAST_OWNER_ID = 'infast'; // Singleton platform wallet

/**
 * Get or create wallet for an owner.
 */
const getOrCreateWallet = async (ownerId, ownerType) => {
  let wallet = await Wallet.findOne({ ownerId, ownerType });
  if (!wallet) {
    wallet = await Wallet.create({ ownerId, ownerType });
  }
  return wallet;
};

/**
 * Credit a wallet and record transaction.
 */
const creditWallet = async (wallet, amount, txData) => {
  const balanceBefore = wallet.balance;
  wallet.balance += amount;
  wallet.totalEarned += amount;
  await wallet.save();

  await EatsTransaction.create({
    walletId: wallet._id,
    ownerId: wallet.ownerId,
    ownerType: wallet.ownerType,
    amount,
    direction: 'credit',
    balanceBefore,
    balanceAfter: wallet.balance,
    status: 'completed',
    ...txData,
  });

  return wallet;
};

/**
 * Debit a wallet and record transaction.
 * Returns false if insufficient balance.
 */
const debitWallet = async (wallet, amount, txData) => {
  if (wallet.balance < amount) {
    return null; // insufficient balance
  }

  const balanceBefore = wallet.balance;
  wallet.balance -= amount;
  wallet.totalWithdrawn += amount;
  await wallet.save();

  await EatsTransaction.create({
    walletId: wallet._id,
    ownerId: wallet.ownerId,
    ownerType: wallet.ownerType,
    amount,
    direction: 'debit',
    balanceBefore,
    balanceAfter: wallet.balance,
    status: 'completed',
    ...txData,
  });

  return wallet;
};

/**
 * Main settlement function.
 * Called automatically when order status → 'delivered'.
 * Splits money: restaurant + courier + infast.
 */
const settleOrder = async (order) => {
  try {
    // Prevent double settlement
    if (order.isSettled) {
      console.log(`[WalletService] Order ${order._id} already settled. Skipping.`);
      return;
    }

    const restaurantId = order.restaurantId?._id || order.restaurantId;
    const courierId = order.courierId?._id || order.courierId;
    const subtotal = order.subtotal || 0;
    const deliveryFee = order.deliveryFee || 0;
    const serviceFee = order.serviceFee || 2000;
    const paymentMethod = order.paymentMethod || 'cash';
    const orderRef = `IF-${String(order._id).slice(-5).toUpperCase()}`;

    console.log(`[WalletService] Settling order ${orderRef}: subtotal=${subtotal}, delivery=${deliveryFee}, service=${serviceFee}`);

    // 1. Restaurant gets subtotal
    if (restaurantId && subtotal > 0) {
      const restaurantWallet = await getOrCreateWallet(restaurantId, 'restaurant');
      await creditWallet(restaurantWallet, subtotal, {
        orderId: order._id,
        type: 'restaurant_earning',
        paymentMethod,
        description: `Buyurtma ${orderRef} uchun daromad`,
      });
    }

    // 2. Courier gets deliveryFee + track cash debt if cash payment
    if (courierId && deliveryFee > 0) {
      const courierWallet = await getOrCreateWallet(courierId, 'courier');
      await creditWallet(courierWallet, deliveryFee, {
        orderId: order._id,
        type: 'courier_earning',
        paymentMethod,
        description: `Yetkazib berish haqi ${orderRef}`,
      });

      // If cash: courier collected cash from customer → debit balance by order total
      if (paymentMethod === 'cash') {
        const totalCollected = subtotal + deliveryFee + serviceFee;
        const balanceBefore = courierWallet.balance;
        
        courierWallet.balance -= totalCollected;
        courierWallet.cashDebt = courierWallet.balance < 0 ? -courierWallet.balance : 0;
        await courierWallet.save();

        await EatsTransaction.create({
          walletId: courierWallet._id,
          ownerId: courierWallet.ownerId,
          ownerType: 'courier',
          orderId: order._id,
          amount: totalCollected,
          direction: 'debit',
          type: 'cash_settlement',
          paymentMethod,
          balanceBefore,
          balanceAfter: courierWallet.balance,
          status: 'completed',
          description: `Mijozdan yig'ilgan naqd pul: -${totalCollected.toLocaleString()} UZS (Buyurtma ${orderRef})`,
        });

        console.log(`[WalletService] Courier ${courierId} cash collected: ${totalCollected}, balance: ${balanceBefore} -> ${courierWallet.balance}`);
      }
    }

    // 3. InFast platform gets serviceFee
    if (serviceFee > 0) {
      const infastWallet = await getOrCreateWallet(INFAST_OWNER_ID, 'infast');
      await creditWallet(infastWallet, serviceFee, {
        orderId: order._id,
        type: 'service_fee',
        paymentMethod,
        description: `Servis to'lovi ${orderRef}`,
      });
    }

    // Mark order as settled
    await FoodOrder.findByIdAndUpdate(order._id, { isSettled: true });

    console.log(`[WalletService] Order ${orderRef} settled successfully.`);
    return true;
  } catch (err) {
    console.error(`[WalletService] Settlement failed for order ${order._id}:`, err.message);
    throw err;
  }
};

/**
 * Courier cash settlement — courier pays collected cash back to platform.
 * Credits courier's wallet to reduce negative balance/debt.
 */
const settleCourierCash = async (courierId, amount, paymentMethod, orderIds = []) => {
  const courierWallet = await getOrCreateWallet(courierId, 'courier');
  const currentDebt = courierWallet.balance < 0 ? -courierWallet.balance : 0;

  if (currentDebt < amount) {
    throw new Error(`Naqd qarz (${currentDebt.toLocaleString()} UZS) dan ko'p miqdor kiritildi.`);
  }

  const balanceBefore = courierWallet.balance;
  courierWallet.balance += amount;
  courierWallet.cashDebt = courierWallet.balance < 0 ? -courierWallet.balance : 0;
  await courierWallet.save();

  await EatsTransaction.create({
    walletId: courierWallet._id,
    ownerId: courierId,
    ownerType: 'courier',
    amount,
    direction: 'credit',
    type: 'cash_settlement',
    paymentMethod,
    status: 'completed',
    balanceBefore,
    balanceAfter: courierWallet.balance,
    description: `Naqd pul topshirildi (${paymentMethod}). Qarz yopildi: ${balanceBefore.toLocaleString()} → ${courierWallet.balance.toLocaleString()} UZS`,
    orderId: orderIds.length > 0 ? orderIds[0] : null,
  });

  return courierWallet;
};

/**
 * Process a withdrawal request — deduct from wallet balance.
 * Called by admin when approving a withdrawal.
 */
const processWithdrawal = async (walletId, amount) => {
  const wallet = await Wallet.findById(walletId);
  if (!wallet) throw new Error('Wallet topilmadi');

  return await debitWallet(wallet, amount, {
    type: 'withdrawal',
    paymentMethod: 'click',
    description: `Pul chiqarish so'rovi tasdiqlandi`,
  });
};

module.exports = {
  getOrCreateWallet,
  creditWallet,
  debitWallet,
  settleOrder,
  settleCourierCash,
  processWithdrawal,
};
