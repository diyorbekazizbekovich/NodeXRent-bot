/**
 * Device (PlayStation / InventoryUnit) status vocabulary & order mapping.
 * Single source of truth for assignability and order↔device sync.
 *
 * InventoryUnit (asset) return path: RENTED → INSPECTION (not AVAILABLE).
 * PlayStation (courier device) on return/cancel: frees to AVAILABLE.
 */

const DeviceStatus = Object.freeze({
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  RENTED: "RENTED",
  INSPECTION: "INSPECTION",
  MAINTENANCE: "MAINTENANCE",
  DISABLED: "DISABLED",
  LOST: "LOST",
  MISSING_PARTS: "MISSING_PARTS",
  DEFECTIVE: "DEFECTIVE",
});

/** Only these may be claimed for a new order assignment */
const ASSIGNABLE_DEVICE_STATUSES = Object.freeze([DeviceStatus.AVAILABLE]);

/** Occupying — never shown as free for new bookings */
const OCCUPYING_DEVICE_STATUSES = Object.freeze([
  DeviceStatus.RESERVED,
  DeviceStatus.RENTED,
]);

/** Never assignable to orders (admin/ops only) */
const BLOCKED_DEVICE_STATUSES = Object.freeze([
  DeviceStatus.RESERVED,
  DeviceStatus.RENTED,
  DeviceStatus.INSPECTION,
  DeviceStatus.MAINTENANCE,
  DeviceStatus.DISABLED,
  DeviceStatus.LOST,
  DeviceStatus.MISSING_PARTS,
  DeviceStatus.DEFECTIVE,
]);

/**
 * Target status for a given order status.
 * InventoryUnit uses this map as-is (RETURNED/COMPLETED → INSPECTION).
 * PlayStation maps INSPECTION → AVAILABLE via expectedPlaystationStatus().
 * EXPIRED keeps RENTED — rental end alone must NOT free the device.
 */
const ORDER_TO_DEVICE_STATUS = Object.freeze({
  PENDING: null,
  ADMIN_CONFIRMED: null,
  COURIER_ASSIGNED: DeviceStatus.RESERVED,
  ACCEPTED: DeviceStatus.RESERVED,
  ON_THE_WAY: DeviceStatus.RESERVED,
  ARRIVED: DeviceStatus.RESERVED,
  DELIVERED: DeviceStatus.RENTED,
  ACTIVE: DeviceStatus.RENTED,
  RETURN_REQUESTED: DeviceStatus.RENTED,
  RETURN_ASSIGNED: DeviceStatus.RENTED,
  PICKED_UP: DeviceStatus.RENTED,
  EXPIRED: DeviceStatus.RENTED,
  RETURNED: DeviceStatus.INSPECTION,
  COMPLETED: DeviceStatus.INSPECTION,
  CANCELLED: DeviceStatus.AVAILABLE,
  REJECTED: DeviceStatus.AVAILABLE,
});

/** Order statuses that keep playstationId "occupied" (unique index) */
const DEVICE_OCCUPYING_ORDER_STATUSES = Object.freeze([
  "COURIER_ASSIGNED",
  "ACCEPTED",
  "ON_THE_WAY",
  "ARRIVED",
  "DELIVERED",
  "ACTIVE",
  "RETURN_REQUESTED",
  "RETURN_ASSIGNED",
  "PICKED_UP",
  "EXPIRED",
]);

function expectedDeviceStatus(orderStatus) {
  return ORDER_TO_DEVICE_STATUS[orderStatus] ?? null;
}

/** Courier PlayStation frees on return; assets go to INSPECTION instead. */
function expectedPlaystationStatus(orderStatus) {
  const target = expectedDeviceStatus(orderStatus);
  if (target === DeviceStatus.INSPECTION) return DeviceStatus.AVAILABLE;
  return target;
}

function expectedInventoryUnitStatus(orderStatus) {
  return expectedDeviceStatus(orderStatus);
}

function isAssignable(status) {
  return status === DeviceStatus.AVAILABLE;
}

function isReleaseTarget(orderStatus) {
  const t = expectedDeviceStatus(orderStatus);
  return t === DeviceStatus.AVAILABLE || t === DeviceStatus.INSPECTION;
}

module.exports = {
  DeviceStatus,
  ASSIGNABLE_DEVICE_STATUSES,
  OCCUPYING_DEVICE_STATUSES,
  BLOCKED_DEVICE_STATUSES,
  ORDER_TO_DEVICE_STATUS,
  DEVICE_OCCUPYING_ORDER_STATUSES,
  expectedDeviceStatus,
  expectedPlaystationStatus,
  expectedInventoryUnitStatus,
  isAssignable,
  isReleaseTarget,
};
