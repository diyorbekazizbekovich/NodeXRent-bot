/**
 * Confirmation window + reminder kind smoke tests (no DB).
 * Run: node scripts/test-order-confirmation.js
 */
const {
  isConfirmWindowOpen,
  getHoursUntilStart,
  isOrderConfirmed,
  ReminderKind,
} = require("../src/constants/orderConfirmation");
const { canConfirmOrder, assertCanConfirmOrder } = require("../src/services/orderConfirmation.service");

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

require("../src/services/reminder.service");
require("../src/jobs/reminder.job");
console.log("PASS  modules load");

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll confirmation tests passed");
