/**
 * Smoke tests for open-order statuses + resource release helpers (no DB).
 * Run: node scripts/test-order-lifecycle.js
 */
const {
  USER_OPEN_ORDER_STATUSES,
  RESOURCE_RELEASE_STATUSES,
} = require("../src/constants/orderStatus");
const { ActiveOrderExistsError } = require("../src/errors/order.errors");
const { collectItemIds } = require("../src/services/orderResource.service");

let failed = 0;
function check(name, cond) {
  if (!cond) {
    failed += 1;
    console.log(`FAIL  ${name}`);
  } else {
    console.log(`PASS  ${name}`);
  }
}

check(
  "open statuses include PENDING..ACTIVE",
  USER_OPEN_ORDER_STATUSES.includes("PENDING") &&
    USER_OPEN_ORDER_STATUSES.includes("ADMIN_CONFIRMED") &&
    USER_OPEN_ORDER_STATUSES.includes("COURIER_ASSIGNED") &&
    USER_OPEN_ORDER_STATUSES.includes("ACCEPTED") &&
    USER_OPEN_ORDER_STATUSES.includes("ON_THE_WAY") &&
    USER_OPEN_ORDER_STATUSES.includes("ARRIVED") &&
    USER_OPEN_ORDER_STATUSES.includes("DELIVERED") &&
    USER_OPEN_ORDER_STATUSES.includes("ACTIVE")
);

check("open statuses exclude CANCELLED", !USER_OPEN_ORDER_STATUSES.includes("CANCELLED"));
check("open statuses exclude COMPLETED", !USER_OPEN_ORDER_STATUSES.includes("COMPLETED"));

check(
  "release statuses cover cancel/reject/complete",
  RESOURCE_RELEASE_STATUSES.includes("CANCELLED") &&
    RESOURCE_RELEASE_STATUSES.includes("REJECTED") &&
    RESOURCE_RELEASE_STATUSES.includes("COMPLETED")
);

const err = new ActiveOrderExistsError(42);
check("ActiveOrderExistsError code", err.code === "ACTIVE_ORDER_EXISTS");
check("ActiveOrderExistsError messageKey", err.messageKey === "orderErrors.activeOrderExists");

const ids = collectItemIds({
  consoleItemId: 1,
  hdmiItemId: 2,
  powerItemId: 2,
  orderItems: [{ inventoryItemId: 3 }, { inventoryItemId: 1 }],
});
check("collectItemIds unique", ids.sort().join(",") === "1,2,3");

const assignment = require("../src/services/orderAssignment.service");
check("cancelOrderBySystem exported", typeof assignment.cancelOrderBySystem === "function");
check("terminateOrderWithRelease exported", typeof assignment.terminateOrderWithRelease === "function");

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll lifecycle smoke tests passed");
