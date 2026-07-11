/**
 * Central booking-slot algorithm (Asia/Tashkent).
 *
 * Working window: 09:00 → 02:00 (overnight).
 * Slots: full hours only (no :30).
 * Lead time: book hour H by (H−1):10 inclusive (50 min before).
 * Last slot 02:00: bookable until 01:40 inclusive (20 min before).
 * Order creation: open 08:00–02:00; closed 02:01–07:59.
 */

const { zonedParts, zonedDateTime, startOfDay, addHours } = require("../utils/dateHelper");

const WORKING_OPEN_HOUR = 9;
const WORKING_CLOSE_HOUR = 2; // last bookable hour
const ORDER_CREATION_PREOPEN_HOUR = 8;
const STANDARD_CUTOFF_MINUTE = 10; // (H-1):10
const LAST_SLOT_CUTOFF_MINUTE = 40; // 01:40 for 02:00

/** Full-hour slots on a calendar day (early morning + day/evening). */
const DAY_SLOTS = Object.freeze([
  "00:00",
  "01:00",
  "02:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
]);

/** @deprecated alias — kept for callers expecting TIME_SLOTS */
const TIME_SLOTS = DAY_SLOTS;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function slotLabel(hour) {
  return `${pad2(hour)}:00`;
}

function isSameCalendarDay(a, b) {
  const p1 = zonedParts(a);
  const p2 = zonedParts(b);
  return p1.year === p2.year && p1.month === p2.month && p1.day === p2.day;
}

function parseTimeSlot(time) {
  const match = String(time).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function combineDateAndTime(baseDate, time) {
  const parsed = parseTimeSlot(time);
  if (!parsed) return null;
  const p = zonedParts(baseDate);
  return zonedDateTime(p.year, p.month, p.day, parsed.hours, parsed.minutes, 0);
}

function isWorkingHourSlot(hours, minutes = 0) {
  if (minutes !== 0) return false;
  if (hours >= WORKING_OPEN_HOUR && hours <= 23) return true;
  if (hours >= 0 && hours <= WORKING_CLOSE_HOUR) return true;
  return false;
}

/**
 * Order flow may start from 08:00 through 02:00 (incl. pre-open for 09:00 bookings).
 * Closed strictly between 02:01 and 07:59.
 */
function isOrderCreationOpen(now = new Date()) {
  const p = zonedParts(now);
  const mins = p.hour * 60 + p.minute;
  const closeMins = WORKING_CLOSE_HOUR * 60; // 02:00
  const openMins = ORDER_CREATION_PREOPEN_HOUR * 60; // 08:00
  if (mins > closeMins && mins < openMins) return false;
  return true;
}

function advanceCalendarDay(year, month, day, addDays = 1) {
  const noon = zonedDateTime(year, month, day, 12, 0, 0);
  const next = addHours(noon, addDays * 24);
  const p = zonedParts(next);
  return { year: p.year, month: p.month, day: p.day };
}

/**
 * Earliest full-hour datetime the customer may book.
 */
function getEarliestBookableDatetime(now = new Date()) {
  const p = zonedParts(now);

  // Last slot of the night: 02:00 allowed until 01:40 inclusive
  if (p.hour === 1 && p.minute <= LAST_SLOT_CUTOFF_MINUTE) {
    return zonedDateTime(p.year, p.month, p.day, WORKING_CLOSE_HOUR, 0, 0);
  }

  // Standard 10-minute rule: ≤:10 → next hour; >:10 → skip one hour
  let hour = p.hour + (p.minute <= STANDARD_CUTOFF_MINUTE ? 1 : 2);
  let { year, month, day } = p;

  if (hour >= 24) {
    hour -= 24;
    ({ year, month, day } = advanceCalendarDay(year, month, day, 1));
  }

  // Closed gap 03:00–08:00 → jump to 09:00 same calendar day
  if (hour > WORKING_CLOSE_HOUR && hour < WORKING_OPEN_HOUR) {
    hour = WORKING_OPEN_HOUR;
  }

  return zonedDateTime(year, month, day, hour, 0, 0);
}

/**
 * Available full-hour slots for the selected calendar day.
 */
function getAvailableTimeSlots(baseDate, now = new Date()) {
  const base = new Date(baseDate);
  if (isNaN(base.getTime())) return [];

  const dayStart = startOfDay(base);
  if (dayStart.getTime() < startOfDay(now).getTime()) return [];

  const earliest = getEarliestBookableDatetime(now);

  return DAY_SLOTS.filter((slot) => {
    const slotDate = combineDateAndTime(base, slot);
    if (!slotDate) return false;
    const parsed = parseTimeSlot(slot);
    if (!parsed || !isWorkingHourSlot(parsed.hours, parsed.minutes)) return false;
    return slotDate.getTime() >= earliest.getTime();
  });
}

const PAST_TIME_MESSAGE =
  "❌ Siz tanlagan vaqt allaqachon o'tib ketgan yoki bron qilish muddati tugagan.\n\nIltimos, mavjud to'liq soatlardan birini tanlang.";

/**
 * Backend validation for order start datetime.
 */
function validateStartDatetime(startDatetime, now = new Date()) {
  const start = new Date(startDatetime);
  if (isNaN(start.getTime())) {
    return { valid: false, reason: "Boshlanish vaqti noto'g'ri", code: "INVALID" };
  }

  const sp = zonedParts(start);

  if (sp.minute !== 0 || sp.second !== 0) {
    return {
      valid: false,
      reason: "Faqat to'liq soatlar (masalan 10:00) tanlanadi",
      code: "NOT_FULL_HOUR",
    };
  }

  if (!isWorkingHourSlot(sp.hour, sp.minute)) {
    return {
      valid: false,
      reason: "Xizmat 09:00 dan 02:00 gacha ishlaydi",
      code: "OUTSIDE_HOURS",
    };
  }

  if (start.getTime() < startOfDay(now).getTime()) {
    return { valid: false, reason: "O'tib ketgan sanani tanlab bo'lmaydi", code: "PAST_DATE" };
  }

  const earliest = getEarliestBookableDatetime(now);
  if (start.getTime() < earliest.getTime()) {
    return { valid: false, reason: PAST_TIME_MESSAGE, code: "PAST_TIME" };
  }

  return { valid: true, start };
}

module.exports = {
  WORKING_OPEN_HOUR,
  WORKING_CLOSE_HOUR,
  ORDER_CREATION_PREOPEN_HOUR,
  STANDARD_CUTOFF_MINUTE,
  LAST_SLOT_CUTOFF_MINUTE,
  DAY_SLOTS,
  TIME_SLOTS,
  PAST_TIME_MESSAGE,
  isSameCalendarDay,
  parseTimeSlot,
  combineDateAndTime,
  isWorkingHourSlot,
  isOrderCreationOpen,
  getEarliestBookableDatetime,
  getAvailableTimeSlots,
  validateStartDatetime,
  slotLabel,
};
