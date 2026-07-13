const env = require("../config/env");
const {
  isConfirmWindowOpen,
  getHoursUntilStart,
  isOrderConfirmed,
} = require("../constants/orderConfirmation");
const { OrderAssignmentError } = require("../errors/order.errors");

function confirmWindowHours() {
  return Number(env.ORDER_CONFIRM_WINDOW_HOURS) || 6;
}

function canConfirmOrder(order, now = new Date()) {
  if (!order?.startDatetime) return false;
  return isConfirmWindowOpen(order.startDatetime, confirmWindowHours(), now);
}

/**
 * Backend gate — Telegram UI cannot bypass.
 */
function assertCanConfirmOrder(order, now = new Date()) {
  if (!order) {
    throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");
  }
  if (!canConfirmOrder(order, now)) {
    const hours = getHoursUntilStart(order.startDatetime, now);
    const err = new OrderAssignmentError(
      "CONFIRM_TOO_EARLY",
      "⏳ Ushbu buyurtmani hali tasdiqlab bo'lmaydi."
    );
    err.messageKey = "orderConfirm.tooEarly";
    err.hoursUntilStart = hours;
    err.confirmWindowHours = confirmWindowHours();
    throw err;
  }
}

module.exports = {
  confirmWindowHours,
  canConfirmOrder,
  assertCanConfirmOrder,
  isOrderConfirmed,
  getHoursUntilStart,
};
