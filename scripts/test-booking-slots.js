/**
 * Booking slot algorithm self-test (no test runner required).
 * Run: node scripts/test-booking-slots.js
 */
const {
  getEarliestBookableDatetime,
  getAvailableTimeSlots,
  isOrderCreationOpen,
  validateStartDatetime,
  combineDateAndTime,
} = require("../src/services/bookingSlot.service");
const { zonedDateTime, formatDatetime, startOfDay } = require("../src/utils/dateHelper");

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function earliestLabel(y, m, d, h, min) {
  const now = zonedDateTime(y, m, d, h, min, 0);
  const earliest = getEarliestBookableDatetime(now);
  return formatDatetime(earliest).slice(11); // HH:MM via formatDatetime is DD.MM.YYYY HH:MM — take time part carefully
}

function earliestHour(y, m, d, h, min) {
  const now = zonedDateTime(y, m, d, h, min, 0);
  const earliest = getEarliestBookableDatetime(now);
  const { formatDatetime: _f, zonedParts } = require("../src/utils/dateHelper");
  const p = zonedParts(earliest);
  return `${String(p.hour).padStart(2, "0")}:00`;
}

function run() {
  // --- 10-minute rule examples ---
  assert(earliestHour(2026, 7, 12, 8, 10) === "09:00", "08:10 → 09:00");
  assert(earliestHour(2026, 7, 12, 8, 11) === "10:00", "08:11 → 10:00");
  assert(earliestHour(2026, 7, 12, 9, 5) === "10:00", "09:05 → 10:00");
  assert(earliestHour(2026, 7, 12, 9, 9) === "10:00", "09:09 → 10:00");
  assert(earliestHour(2026, 7, 12, 9, 10) === "10:00", "09:10 → 10:00");
  assert(earliestHour(2026, 7, 12, 9, 11) === "11:00", "09:11 → 11:00");
  assert(earliestHour(2026, 7, 12, 13, 2) === "14:00", "13:02 → 14:00");
  assert(earliestHour(2026, 7, 12, 13, 10) === "14:00", "13:10 → 14:00");
  assert(earliestHour(2026, 7, 12, 13, 15) === "15:00", "13:15 → 15:00");

  // --- Working hours edge cases ---
  assert(earliestHour(2026, 7, 12, 1, 30) === "02:00", "01:30 → 02:00");
  assert(earliestHour(2026, 7, 12, 1, 41) === "09:00", "01:41 → 09:00");
  assert(earliestHour(2026, 7, 12, 2, 1) === "09:00", "02:01 → 09:00");
  // 08:30 is past 08:10 cutoff for 09:00 → earliest 10:00 (10-minute rule)
  assert(earliestHour(2026, 7, 12, 8, 30) === "10:00", "08:30 → 10:00");

  // --- Order creation window ---
  assert(isOrderCreationOpen(zonedDateTime(2026, 7, 12, 8, 30)) === true, "08:30 open");
  assert(isOrderCreationOpen(zonedDateTime(2026, 7, 12, 1, 30)) === true, "01:30 open");
  assert(isOrderCreationOpen(zonedDateTime(2026, 7, 12, 2, 1)) === false, "02:01 closed");
  assert(isOrderCreationOpen(zonedDateTime(2026, 7, 12, 3, 0)) === false, "03:00 closed");
  assert(isOrderCreationOpen(zonedDateTime(2026, 7, 12, 10, 0)) === true, "10:00 open");

  // --- Full-hour slots only (no :30) ---
  const slotsMorning = getAvailableTimeSlots(
    startOfDay(zonedDateTime(2026, 7, 12, 0, 0, 0)),
    zonedDateTime(2026, 7, 12, 8, 0, 0)
  );
  assert(slotsMorning.every((s) => s.endsWith(":00")), "only full hours");
  assert(!slotsMorning.includes("09:30"), "no 09:30");
  assert(slotsMorning.includes("09:00"), "has 09:00");
  assert(!slotsMorning.includes("02:00"), "02:00 already past at 08:00");

  const slotsNight = getAvailableTimeSlots(
    startOfDay(zonedDateTime(2026, 7, 12, 0, 0, 0)),
    zonedDateTime(2026, 7, 12, 1, 0, 0)
  );
  assert(slotsNight.includes("02:00"), "01:00 still allows 02:00");
  assert(slotsNight.includes("09:00"), "also later day slots");

  // --- Validation rejects :30 and past ---
  const badHalf = combineDateAndTime(zonedDateTime(2026, 7, 12, 0, 0, 0), "10:30");
  // combine allows parsing 10:30 but validate must reject
  const vHalf = validateStartDatetime(
    zonedDateTime(2026, 7, 12, 10, 30, 0).toISOString(),
    zonedDateTime(2026, 7, 12, 8, 0, 0)
  );
  assert(vHalf.valid === false && vHalf.code === "NOT_FULL_HOUR", "reject :30");

  const vOk = validateStartDatetime(
    zonedDateTime(2026, 7, 12, 10, 0, 0).toISOString(),
    zonedDateTime(2026, 7, 12, 8, 0, 0)
  );
  assert(vOk.valid === true, "accept 10:00");

  const vPast = validateStartDatetime(
    zonedDateTime(2026, 7, 12, 9, 0, 0).toISOString(),
    zonedDateTime(2026, 7, 12, 8, 11, 0)
  );
  assert(vPast.valid === false && vPast.code === "PAST_TIME", "08:11 cannot book 09:00");

  // Midnight wrap: 23:50 → 01:00 next day
  assert(earliestHour(2026, 7, 12, 23, 50) === "01:00", "23:50 → 01:00 next calendar logic");

  console.log("All booking slot tests passed.");
}

run();
