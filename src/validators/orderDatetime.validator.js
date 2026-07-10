const { startOfDay, zonedParts, zonedDateTime } = require("../utils/dateHelper");

const TIME_SLOTS = [];
for (let hour = 9; hour <= 23; hour++) {
  for (const minute of [0, 30]) {
    if (hour === 23 && minute === 30) break;
    TIME_SLOTS.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
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

function getAvailableTimeSlots(baseDate, now = new Date()) {
  const base = new Date(baseDate);
  if (isNaN(base.getTime())) return [];

  if (!isSameCalendarDay(base, now)) {
    const baseStart = startOfDay(base);
    if (baseStart.getTime() < startOfDay(now).getTime()) return [];
    return [...TIME_SLOTS];
  }

  return TIME_SLOTS.filter((slot) => {
    const slotDate = combineDateAndTime(base, slot);
    return slotDate && slotDate.getTime() > now.getTime();
  });
}

const PAST_TIME_MESSAGE =
  "❌ Siz tanlagan vaqt allaqachon o'tib ketgan.\n\nIltimos, hozirgi vaqtdan keyingi vaqtni tanlang.";

function validateStartDatetime(startDatetime, now = new Date()) {
  const start = new Date(startDatetime);
  if (isNaN(start.getTime())) {
    return { valid: false, reason: "Boshlanish vaqti noto'g'ri", code: "INVALID" };
  }

  if (start.getTime() < startOfDay(now).getTime()) {
    return { valid: false, reason: "O'tib ketgan sanani tanlab bo'lmaydi", code: "PAST_DATE" };
  }

  if (start.getTime() <= now.getTime()) {
    return { valid: false, reason: PAST_TIME_MESSAGE, code: "PAST_TIME" };
  }

  return { valid: true, start };
}

module.exports = {
  TIME_SLOTS,
  PAST_TIME_MESSAGE,
  isSameCalendarDay,
  parseTimeSlot,
  combineDateAndTime,
  getAvailableTimeSlots,
  validateStartDatetime,
};
