/**
 * Order status transition matrix smoke tests (no DB).
 * Run: node scripts/test-order-transitions.js
 */
const { OrderStatus } = require("../src/constants/orderStatus");
const {
  canTransition,
  assertTransition,
  isCourierPoolStatus,
  COURIER_POOL_STATUSES,
} = require("../src/constants/orderTransitions");

let failed = 0;
function check(name, cond) {
  if (!cond) {
    failed += 1;
    console.log(`FAIL  ${name}`);
  } else console.log(`PASS  ${name}`);
}

check("PENDING → ADMIN_CONFIRMED", canTransition(OrderStatus.PENDING, OrderStatus.ADMIN_CONFIRMED));
check("PENDING ↛ COURIER_ASSIGNED", !canTransition(OrderStatus.PENDING, OrderStatus.COURIER_ASSIGNED));
check("ADMIN_CONFIRMED → COURIER_ASSIGNED", canTransition(OrderStatus.ADMIN_CONFIRMED, OrderStatus.COURIER_ASSIGNED));
check("ADMIN_CONFIRMED ↛ ON_THE_WAY", !canTransition(OrderStatus.ADMIN_CONFIRMED, OrderStatus.ON_THE_WAY));
check("COURIER_ASSIGNED → ON_THE_WAY", canTransition(OrderStatus.COURIER_ASSIGNED, OrderStatus.ON_THE_WAY));
check("ON_THE_WAY → ARRIVED", canTransition(OrderStatus.ON_THE_WAY, OrderStatus.ARRIVED));
check("ARRIVED → ACTIVE", canTransition(OrderStatus.ARRIVED, OrderStatus.ACTIVE));
check("pool includes ADMIN_CONFIRMED", isCourierPoolStatus(OrderStatus.ADMIN_CONFIRMED));
check("PENDING not pool", !isCourierPoolStatus(OrderStatus.PENDING));
check("ACTIVE_RENTAL alias", OrderStatus.ACTIVE_RENTAL === OrderStatus.ACTIVE);

let threw = false;
try {
  assertTransition(OrderStatus.PENDING, OrderStatus.ON_THE_WAY);
} catch (e) {
  threw = e.code === "INVALID_TRANSITION";
}
check("assert invalid throws", threw);

check("COURIER_POOL_STATUSES length", COURIER_POOL_STATUSES.length >= 1);

require("../src/services/orderWorkflow.service");
require("../src/services/courierWorkflow.service");
require("../src/services/orderStatus.manager");
require("../src/services/orderAssignment.service");
console.log("PASS  workflow modules load");

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll transition tests passed");
