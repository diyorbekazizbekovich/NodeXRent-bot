/**
 * Device (PlayStation / InventoryUnit) status vocabulary & order mapping.
 * Single source of truth for assignability and order↔device sync.
 */

const DeviceStatus = Object.freeze({
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  RENTED: "RENTED",
  MAINTENANCE: "MAINTENANCE",
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
  DeviceStatus.MAINTENANCE,
  DeviceStatus.MISSING_PARTS,
  DeviceStatus.DEFECTIVE,
]);

/**
 * Target PlayStation status for a given order status.
 * null = no device transition required (e.g. PENDING without PS).
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
  EXPIRED: DeviceStatus.RENTED,
  RETURNED: DeviceStatus.AVAILABLE,
  COMPLETED: DeviceStatus.AVAILABLE,
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
  "EXPIRED",
]);

function expectedDeviceStatus(orderStatus) {
  return ORDER_TO_DEVICE_STATUS[orderStatus] ?? null;
}

function isAssignable(status) {
  return status === DeviceStatus.AVAILABLE;
}

function isReleaseTarget(orderStatus) {
  return expectedDeviceStatus(orderStatus) === DeviceStatus.AVAILABLE;
}

module.exports = {
  DeviceStatus,
  ASSIGNABLE_DEVICE_STATUSES,
  OCCUPYING_DEVICE_STATUSES,
  BLOCKED_DEVICE_STATUSES,
  ORDER_TO_DEVICE_STATUS,
  DEVICE_OCCUPYING_ORDER_STATUSES,
  expectedDeviceStatus,
  isAssignable,
  isReleaseTarget,
};
