/**
 * Inventory asset (InventoryUnit) status vocabulary & allowed transitions.
 * Single source of truth for console asset lifecycle.
 */

/**
 * Physical console asset statuses (DB enum PlaystationStatus).
 * Business aliases (docs / future migration):
 *   ON_DELIVERY ≈ RESERVED while courier delivers
 *   RETURN_PENDING ≈ INSPECTION after pickup
 *   UNDER_REPAIR ≈ MAINTENANCE
 *   BROKEN ≈ DEFECTIVE / DISABLED
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

/** Semantic aliases — same values as AssetStatus (no separate DB enums yet) */
const AssetStatusAlias = Object.freeze({
  ON_DELIVERY: AssetStatus.RESERVED,
  RETURN_PENDING: AssetStatus.INSPECTION,
  UNDER_REPAIR: AssetStatus.MAINTENANCE,
  BROKEN: AssetStatus.DEFECTIVE,
});

/** Strict business transitions (asset management). */
const ALLOWED_TRANSITIONS = Object.freeze({
  [AssetStatus.AVAILABLE]: [
    AssetStatus.RESERVED,
    AssetStatus.MAINTENANCE, // admin: to'g'ridan-to'g'ri ta'mirga
    AssetStatus.DISABLED,
    AssetStatus.LOST,
  ],
  [AssetStatus.RESERVED]: [AssetStatus.RENTED, AssetStatus.AVAILABLE],
  [AssetStatus.RENTED]: [AssetStatus.INSPECTION],
  [AssetStatus.INSPECTION]: [AssetStatus.AVAILABLE, AssetStatus.MAINTENANCE],
  [AssetStatus.MAINTENANCE]: [AssetStatus.AVAILABLE, AssetStatus.DISABLED],
  [AssetStatus.DISABLED]: [AssetStatus.AVAILABLE],
  [AssetStatus.LOST]: [],
  // Legacy recovery paths (ops only)
  [AssetStatus.MISSING_PARTS]: [AssetStatus.AVAILABLE, AssetStatus.DISABLED],
  [AssetStatus.DEFECTIVE]: [AssetStatus.AVAILABLE, AssetStatus.DISABLED],
});

const ASSIGNABLE_STATUSES = Object.freeze([AssetStatus.AVAILABLE]);

const OCCUPYING_STATUSES = Object.freeze([AssetStatus.RESERVED, AssetStatus.RENTED]);

/** Must never be permanently deleted while in active rental cycle */
const NON_DELETABLE_STATUSES = Object.freeze([
  AssetStatus.RESERVED,
  AssetStatus.RENTED,
  AssetStatus.INSPECTION,
]);

/** Units counted in occupancy denominator (excludes DISABLED + LOST) */
const ACTIVE_POOL_STATUSES = Object.freeze([
  AssetStatus.AVAILABLE,
  AssetStatus.RESERVED,
  AssetStatus.RENTED,
  AssetStatus.INSPECTION,
  AssetStatus.MAINTENANCE,
]);

/**
 * Order statuses that keep inventoryUnitId occupied (unique index + conflict checks).
 * ADMIN_CONFIRMED included: reservation happens at admin approve, before courier accept.
 */
const UNIT_OCCUPYING_ORDER_STATUSES = Object.freeze([
  "ADMIN_CONFIRMED",
  "ACCEPTED",
  "COURIER_ASSIGNED",
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
  AssetStatusAlias,
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
