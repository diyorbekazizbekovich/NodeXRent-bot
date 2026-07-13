/**
 * Booking slot algorithm self-test (no test runner required).
 * Run: node scripts/test-booking-slots.js
 */
const {
  getEarliestBookableDatetime,
  getAvailableTimeSlots,
  validateStartDatetime,
  combineDateAndTime,
} = require("../src/services/bookingSlot.service");
const { zonedDateTime, startOfDay, zonedParts } = require("../src/utils/dateHelper");

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function earliestHour(y, m, d, h, min) {
  const now = zonedDateTime(y, m, d, h, min, 0);
  const earliest = getEarliestBookableDatetime(now);
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

  // --- Working hours edge cases (slots only — order flow always open) ---
  assert(earliestHour(2026, 7, 12, 1, 30) === "02:00", "01:30 → 02:00");
  assert(earliestHour(2026, 7, 12, 1, 41) === "09:00", "01:41 → 09:00");
  assert(earliestHour(2026, 7, 12, 2, 1) === "09:00", "02:01 → 09:00");
  assert(earliestHour(2026, 7, 12, 2, 30) === "09:00", "02:30 → 09:00");
  assert(earliestHour(2026, 7, 12, 3, 0) === "09:00", "03:00 → 09:00");
  assert(earliestHour(2026, 7, 12, 6, 30) === "09:00", "06:30 → 09:00");
  assert(earliestHour(2026, 7, 12, 8, 30) === "10:00", "08:30 → 10:00");
  assert(earliestHour(2026, 7, 12, 8, 45) === "10:00", "08:45 → 10:00");

  // --- Full-hour slots only (no :30) ---
  const slotsMorning = getAvailableTimeSlots(
    startOfDay(zonedDateTime(2026, 7, 12, 0, 0, 0)),
    zonedDateTime(2026, 7, 12, 3, 0, 0)
  );
  assert(slotsMorning.every((s) => s.endsWith(":00")), "only full hours");
  assert(!slotsMorning.includes("09:30"), "no 09:30");
  assert(slotsMorning.includes("09:00"), "03:00 → has 09:00");
  assert(!slotsMorning.includes("02:00"), "02:00 already past at 03:00");

  const slotsNight = getAvailableTimeSlots(
    startOfDay(zonedDateTime(2026, 7, 12, 0, 0, 0)),
    zonedDateTime(2026, 7, 12, 1, 0, 0)
  );
  assert(slotsNight.includes("02:00"), "01:00 still allows 02:00");
  assert(slotsNight.includes("09:00"), "also later day slots");

  // Evening today → overnight 00/01/02 (next calendar morning)
  const slotsEvening = getAvailableTimeSlots(
    startOfDay(zonedDateTime(2026, 7, 12, 0, 0, 0)),
    zonedDateTime(2026, 7, 12, 23, 0, 0)
  );
  assert(slotsEvening.includes("00:00"), "23:00 → 00:00 available");
  assert(slotsEvening.includes("01:00"), "23:00 → 01:00 available");
  assert(slotsEvening.includes("02:00"), "23:00 → 02:00 available");
  const overnight = combineDateAndTime(
    startOfDay(zonedDateTime(2026, 7, 12, 0, 0, 0)),
    "01:00",
    zonedDateTime(2026, 7, 12, 23, 0, 0)
  );
  const op = zonedParts(overnight);
  assert(op.day === 13 && op.hour === 1, "01:00 at 23:00 resolves to next day");

  // --- Validation rejects :30 and past ---
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

  assert(earliestHour(2026, 7, 12, 23, 50) === "01:00", "23:50 → 01:00");

  console.log("All booking slot tests passed.");
}

run();
