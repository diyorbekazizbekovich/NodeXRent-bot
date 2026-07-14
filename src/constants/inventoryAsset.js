/**
 * Inventory asset (InventoryUnit) status vocabulary & allowed transitions.
 * Single source of truth for console asset lifecycle.
 */

const AssetStatus = Object.freeze({
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  RENTED: "RENTED",
  INSPECTION: "INSPECTION",
  MAINTENANCE: "MAINTENANCE",
  DISABLED: "DISABLED",
  LOST: "LOST",
  /** Legacy — still present on some rows / PlayStation devices */
  MISSING_PARTS: "MISSING_PARTS",
  DEFECTIVE: "DEFECTIVE",
});

/** Strict business transitions (asset management). */
const ALLOWED_TRANSITIONS = Object.freeze({
  [AssetStatus.AVAILABLE]: [
    AssetStatus.RESERVED,
    AssetStatus.DISABLED,
    AssetStatus.LOST,
  ],
  [AssetStatus.RESERVED]: [AssetStatus.RENTED, AssetStatus.AVAILABLE],
  [AssetStatus.RENTED]: [AssetStatus.INSPECTION],
  [AssetStatus.INSPECTION]: [AssetStatus.AVAILABLE, AssetStatus.MAINTENANCE],
  [AssetStatus.MAINTENANCE]: [AssetStatus.AVAILABLE],
  // Product alias REPAIR === MAINTENANCE (DB enum stays MAINTENANCE)
  [AssetStatus.DISABLED]: [AssetStatus.AVAILABLE],
  [AssetStatus.LOST]: [],
  // Legacy recovery paths (ops only)
  [AssetStatus.MISSING_PARTS]: [AssetStatus.AVAILABLE, AssetStatus.DISABLED],
  [AssetStatus.DEFECTIVE]: [AssetStatus.AVAILABLE, AssetStatus.DISABLED],
});

const ASSIGNABLE_STATUSES = Object.freeze([AssetStatus.AVAILABLE]);

const OCCUPYING_STATUSES = Object.freeze([AssetStatus.RESERVED, AssetStatus.RENTED]);

/** Must never be permanently deleted */
const NON_DELETABLE_STATUSES = Object.freeze([
  AssetStatus.RESERVED,
  AssetStatus.RENTED,
  AssetStatus.INSPECTION,
  AssetStatus.MAINTENANCE,
]);

/** Units counted in occupancy denominator (excludes DISABLED + LOST) */
const ACTIVE_POOL_STATUSES = Object.freeze([
  AssetStatus.AVAILABLE,
  AssetStatus.RESERVED,
  AssetStatus.RENTED,
  AssetStatus.INSPECTION,
  AssetStatus.MAINTENANCE,
]);

/** Order statuses that keep inventoryUnitId "occupied" */
const UNIT_OCCUPYING_ORDER_STATUSES = Object.freeze([
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

const CONSOLE_TYPES = Object.freeze(["PS3", "PS4", "PS5"]);

function canTransition(from, to) {
  if (!from || !to) return false;
  if (from === to) return true;
  const allowed = ALLOWED_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

function assertTransition(from, to) {
  if (from === to) return;
  if (!canTransition(from, to)) {
    const err = new Error(`Noto'g'ri status o'tishi: ${from} → ${to}`);
    err.code = "INVALID_TRANSITION";
    throw err;
  }
}

function isAssignable(status) {
  return status === AssetStatus.AVAILABLE;
}

function isNonDeletable(status) {
  return NON_DELETABLE_STATUSES.includes(status);
}

module.exports = {
  AssetStatus,
  ALLOWED_TRANSITIONS,
  ASSIGNABLE_STATUSES,
  OCCUPYING_STATUSES,
  NON_DELETABLE_STATUSES,
  ACTIVE_POOL_STATUSES,
  UNIT_OCCUPYING_ORDER_STATUSES,
  CONSOLE_TYPES,
  canTransition,
  assertTransition,
  isAssignable,
  isNonDeletable,
};
