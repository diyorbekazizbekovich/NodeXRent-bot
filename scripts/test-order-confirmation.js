/**
 * Confirmation window + user-start reminder policy smoke tests (no DB).
 * Run: node scripts/test-order-confirmation.js
 */
const {
  isConfirmWindowOpen,
  getHoursUntilStart,
  isOrderConfirmed,
  ReminderKind,
  ReminderDecision,
  decideUserStartReminder,
  getUserReminderAt,
} = require("../src/constants/orderConfirmation");
const { canConfirmOrder, assertCanConfirmOrder } = require("../src/services/orderConfirmation.service");
const { formatTime, TZ } = require("../src/utils/dateHelper");

let failed = 0;
function check(name, cond) {
  if (!cond) {
    failed += 1;
    console.log(`FAIL  ${name}`);
  } else console.log(`PASS  ${name}`);
}

const now = new Date("2026-07-12T12:00:00+05:00");

const startIn48h = new Date(now.getTime() + 48 * 3600 * 1000);
const startIn5h = new Date(now.getTime() + 5 * 3600 * 1000);
const startIn2h = new Date(now.getTime() + 2 * 3600 * 1000);

check("48h ahead — window closed", !isConfirmWindowOpen(startIn48h, 6, now));
check("5h ahead — window open", isConfirmWindowOpen(startIn5h, 6, now));
check("2h ahead — window open", isConfirmWindowOpen(startIn2h, 6, now));

check("canConfirm 48h false", !canConfirmOrder({ startDatetime: startIn48h }, now));
check("canConfirm 5h true", canConfirmOrder({ startDatetime: startIn5h }, now));

let threw = false;
try {
  assertCanConfirmOrder({ id: 1, startDatetime: startIn48h }, now);
} catch (e) {
  threw = e.code === "CONFIRM_TOO_EARLY";
}
check("assertTooEarly throws CONFIRM_TOO_EARLY", threw);

check("PENDING not confirmed", !isOrderConfirmed({ status: "PENDING" }));
check("ADMIN_CONFIRMED confirmed", isOrderConfirmed({ status: "ADMIN_CONFIRMED" }));
check("COURIER_ASSIGNED confirmed", isOrderConfirmed({ status: "COURIER_ASSIGNED" }));
check("confirmedAt wins", isOrderConfirmed({ status: "PENDING", confirmedAt: new Date() }));

check("reminder kinds defined", ReminderKind.CONFIRM_READY_6H && ReminderKind.USER_3H);

const hours = getHoursUntilStart(startIn5h, now);
check("hours until ~5", hours > 4.9 && hours < 5.1);

// --- User scenario: start 06:00, now 04:15 → skip 3h+2h, wait 1h ---
const start0600 = new Date("2026-07-22T06:00:00+05:00");
const at0415 = new Date("2026-07-22T04:15:00+05:00");

check(
  "fireAt 3h = 03:00",
  formatTime(getUserReminderAt(start0600, 3)) === "03:00"
);
check(
  "fireAt 2h = 04:00",
  formatTime(getUserReminderAt(start0600, 2)) === "04:00"
);
check(
  "fireAt 1h = 05:00",
  formatTime(getUserReminderAt(start0600, 1)) === "05:00"
);

check(
  "04:15 → 3h SKIP (passed)",
  decideUserStartReminder(start0600, 3, at0415).action === ReminderDecision.SKIP
);
check(
  "04:15 → 2h SKIP (passed)",
  decideUserStartReminder(start0600, 2, at0415).action === ReminderDecision.SKIP
);
check(
  "04:15 → 1h WAIT",
  decideUserStartReminder(start0600, 1, at0415).action === ReminderDecision.WAIT
);

const at0500 = new Date("2026-07-22T05:00:30+05:00");
check(
  "05:00 → 1h SEND",
  decideUserStartReminder(start0600, 1, at0500).action === ReminderDecision.SEND
);
check(
  "05:00 → 3h still SKIP",
  decideUserStartReminder(start0600, 3, at0500).action === ReminderDecision.SKIP
);

// Restart late: reminder was 03:00, bot up at 03:20 → skip, no catch-up
const at0320 = new Date("2026-07-22T03:20:00+05:00");
check(
  "03:20 restart → 3h SKIP (no catch-up)",
  decideUserStartReminder(start0600, 3, at0320).action === ReminderDecision.SKIP
);
check(
  "03:00 exact → 3h SEND",
  decideUserStartReminder(start0600, 3, new Date("2026-07-22T03:00:00+05:00")).action ===
    ReminderDecision.SEND
);
check(
  "02:59 → 3h WAIT",
  decideUserStartReminder(start0600, 3, new Date("2026-07-22T02:59:00+05:00")).action ===
    ReminderDecision.WAIT
);

check("timezone is Asia/Tashkent", TZ === "Asia/Tashkent");

require("../src/services/reminder.service");
require("../src/jobs/reminder.job");
console.log("PASS  modules load");

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll confirmation / reminder policy tests passed");
