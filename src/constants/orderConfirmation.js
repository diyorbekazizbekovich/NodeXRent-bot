/**
 * Order confirmation window & reminder kinds (single source of truth).
 */
const ReminderKind = Object.freeze({
  CONFIRM_READY_6H: "CONFIRM_READY_6H",
  PRIORITY_2H: "PRIORITY_2H",
  USER_3H: "USER_3H",
  USER_2H: "USER_2H",
  USER_1H: "USER_1H",
});

const USER_REMINDER_HOURS = Object.freeze([
  { hours: 3, kind: ReminderKind.USER_3H },
  { hours: 2, kind: ReminderKind.USER_2H },
  { hours: 1, kind: ReminderKind.USER_1H },
]);

/** Statuses that count as "tasdiqlangan" for priority reminders */
const CONFIRMED_ORDER_STATUSES = Object.freeze([
  "ADMIN_CONFIRMED",
  "COURIER_ASSIGNED",
  "ACCEPTED",
  "ON_THE_WAY",
  "ARRIVED",
  "DELIVERED",
  "ACTIVE",
  "RETURN_REQUESTED",
]);

const UNCONFIRMED_STATUSES = Object.freeze(["PENDING"]);

function getHoursUntilStart(startDatetime, now = new Date()) {
  return (new Date(startDatetime).getTime() - now.getTime()) / (60 * 60 * 1000);
}

/**
 * Confirmation allowed when start is within `windowHours` (or already started).
 */
function isConfirmWindowOpen(startDatetime, windowHours, now = new Date()) {
  return getHoursUntilStart(startDatetime, now) <= Number(windowHours);
}

function isOrderConfirmed(order) {
  if (order?.confirmedAt) return true;
  return CONFIRMED_ORDER_STATUSES.includes(order?.status);
}

module.exports = {
  ReminderKind,
  USER_REMINDER_HOURS,
  CONFIRMED_ORDER_STATUSES,
  UNCONFIRMED_STATUSES,
  getHoursUntilStart,
  isConfirmWindowOpen,
  isOrderConfirmed,
};
