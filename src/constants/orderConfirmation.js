/**
 * Order confirmation window & reminder kinds (single source of truth).
 *
 * User start reminders (3h / 2h / 1h) fire ONLY in their exact minute —
 * never catch up missed ones after restart / late cron.
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

/** Reminder decisions (pure policy) */
const ReminderDecision = Object.freeze({
  WAIT: "WAIT",
  SEND: "SEND",
  SKIP: "SKIP",
});

function getHoursUntilStart(startDatetime, now = new Date()) {
  return (new Date(startDatetime).getTime() - now.getTime()) / (60 * 60 * 1000);
}

/**
 * Absolute fire time for an N-hour-before-start reminder.
 * Uses epoch ms (timezone-agnostic); display layers format in Asia/Tashkent.
 */
function getUserReminderAt(startDatetime, hoursBefore) {
  const startMs = new Date(startDatetime).getTime();
  if (!Number.isFinite(startMs)) return null;
  return new Date(startMs - Number(hoursBefore) * 60 * 60 * 1000);
}

/** Floor to UTC minute bucket (cron is per-minute). */
function minuteBucket(date) {
  return Math.floor(new Date(date).getTime() / 60_000);
}

/**
 * Exact-time gate for any absolute fire timestamp.
 * Send only during that calendar minute; later = permanently skip.
 *
 * @returns {{ action: 'WAIT'|'SEND'|'SKIP', fireAt: Date|null, reason?: string }}
 */
function decideExactMinuteFire(fireAt, now = new Date()) {
  if (fireAt == null || !Number.isFinite(new Date(fireAt).getTime())) {
    return {
      action: ReminderDecision.SKIP,
      fireAt: null,
      reason: "Invalid fireAt",
    };
  }
  const at = new Date(fireAt);
  const nowBucket = minuteBucket(now);
  const dueBucket = minuteBucket(at);

  if (nowBucket < dueBucket) {
    return { action: ReminderDecision.WAIT, fireAt: at };
  }
  if (nowBucket === dueBucket) {
    return { action: ReminderDecision.SEND, fireAt: at };
  }
  return {
    action: ReminderDecision.SKIP,
    fireAt: at,
    reason: "Reminder time already passed",
  };
}

/**
 * Exact-time gate: send only during the reminder's calendar minute.
 * Missed minutes are permanently skipped (no compensation).
 *
 * @returns {{ action: 'WAIT'|'SEND'|'SKIP', reminderAt: Date|null, reason?: string }}
 */
function decideUserStartReminder(startDatetime, hoursBefore, now = new Date()) {
  const reminderAt = getUserReminderAt(startDatetime, hoursBefore);
  const decided = decideExactMinuteFire(reminderAt, now);
  return {
    action: decided.action,
    reminderAt: decided.fireAt,
    reason: decided.reason,
  };
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
  ReminderDecision,
  USER_REMINDER_HOURS,
  CONFIRMED_ORDER_STATUSES,
  UNCONFIRMED_STATUSES,
  getHoursUntilStart,
  getUserReminderAt,
  minuteBucket,
  decideExactMinuteFire,
  decideUserStartReminder,
  isConfirmWindowOpen,
  isOrderConfirmed,
};
