/**
 * stateMachine.js
 * Defines valid state transitions for Ride and FoodOrder.
 * Prevents invalid status jumps and ensures data integrity.
 */

// Ride status transitions: only these transitions are allowed
const RIDE_TRANSITIONS = {
  payment_pending: ['searching', 'cancelled'],
  searching:       ['accepted', 'cancelled'],
  accepted:        ['arriving', 'cancelled'],
  arriving:        ['started', 'cancelled'],
  started:         ['completed', 'cancelled'],
  completed:       [],
  cancelled:       [],
};

// FoodOrder status transitions
const FOOD_ORDER_TRANSITIONS = {
  new:       ['pending', 'accepted', 'rejected', 'cancelled'],
  pending:   ['accepted', 'rejected', 'cancelled'],
  accepted:  ['preparing', 'rejected', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready:     ['picked', 'cancelled'],
  picked:    ['delivered', 'cancelled'],
  delivered: [],
  rejected:  [],
  cancelled: [],
};

/**
 * Validate a status transition.
 * @param {Object} transitions - The transition map (RIDE_TRANSITIONS or FOOD_ORDER_TRANSITIONS)
 * @param {string} currentStatus - Current status of the entity
 * @param {string} newStatus - Desired new status
 * @returns {{ valid: boolean, message?: string }}
 */
const validateTransition = (transitions, currentStatus, newStatus) => {
  const allowed = transitions[currentStatus];

  if (!allowed) {
    return {
      valid: false,
      message: `Noma'lum holat: "${currentStatus}". O'tkazish mumkin emas.`,
    };
  }

  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      message: `"${currentStatus}" → "${newStatus}" o'tkazish mumkin emas. Ruxsat etilgan holatlar: [${allowed.join(', ')}]`,
    };
  }

  return { valid: true };
};

const validateRideTransition = (currentStatus, newStatus) =>
  validateTransition(RIDE_TRANSITIONS, currentStatus, newStatus);

const validateFoodOrderTransition = (currentStatus, newStatus) =>
  validateTransition(FOOD_ORDER_TRANSITIONS, currentStatus, newStatus);

module.exports = {
  RIDE_TRANSITIONS,
  FOOD_ORDER_TRANSITIONS,
  validateRideTransition,
  validateFoodOrderTransition,
};
