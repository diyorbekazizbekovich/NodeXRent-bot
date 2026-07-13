/**
 * Device status lifecycle smoke tests (no DB).
 * Run: node scripts/test-device-status.js
 */
const {
  DeviceStatus,
  ASSIGNABLE_DEVICE_STATUSES,
  BLOCKED_DEVICE_STATUSES,
  expectedDeviceStatus,
  isAssignable,
  ORDER_TO_DEVICE_STATUS,
} = require("../src/constants/deviceStatus");

let failed = 0;
function check(name, cond) {
  if (!cond) {
    failed += 1;
    console.log(`FAIL  ${name}`);
  } else {
    console.log(`PASS  ${name}`);
  }
}

check("only AVAILABLE assignable", ASSIGNABLE_DEVICE_STATUSES.length === 1 && isAssignable("AVAILABLE"));
check("MAINTENANCE not assignable", !isAssignable("MAINTENANCE"));
check("RENTED not assignable", !isAssignable("RENTED"));
check("RESERVED not assignable", !isAssignable("RESERVED"));
check("DEFECTIVE blocked", BLOCKED_DEVICE_STATUSES.includes("DEFECTIVE"));

check("COURIER_ASSIGNED → RESERVED", expectedDeviceStatus("COURIER_ASSIGNED") === DeviceStatus.RESERVED);
check("ON_THE_WAY → RESERVED", expectedDeviceStatus("ON_THE_WAY") === DeviceStatus.RESERVED);
check("ACTIVE → RENTED", expectedDeviceStatus("ACTIVE") === DeviceStatus.RENTED);
check("DELIVERED → RENTED", expectedDeviceStatus("DELIVERED") === DeviceStatus.RENTED);
check("EXPIRED → RENTED (not AVAILABLE)", expectedDeviceStatus("EXPIRED") === DeviceStatus.RENTED);
check("CANCELLED → AVAILABLE", expectedDeviceStatus("CANCELLED") === DeviceStatus.AVAILABLE);
check("REJECTED → AVAILABLE", expectedDeviceStatus("REJECTED") === DeviceStatus.AVAILABLE);
check("RETURNED → AVAILABLE", expectedDeviceStatus("RETURNED") === DeviceStatus.AVAILABLE);
check("COMPLETED → AVAILABLE", expectedDeviceStatus("COMPLETED") === DeviceStatus.AVAILABLE);

check(
  "expire never maps to AVAILABLE",
  ORDER_TO_DEVICE_STATUS.EXPIRED !== DeviceStatus.AVAILABLE
);

const deviceStatusService = require("../src/services/deviceStatus.service");
check("claimPlaystation exported", typeof deviceStatusService.claimPlaystation === "function");
check("syncDeviceToOrderStatus exported", typeof deviceStatusService.syncDeviceToOrderStatus === "function");

const assignment = require("../src/services/orderAssignment.service");
check("assign path loads", typeof assignment.acceptOrderByCourier === "function");

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll device-status tests passed");
