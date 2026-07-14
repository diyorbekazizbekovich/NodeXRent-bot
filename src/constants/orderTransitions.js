const { OrderStatus } = require("./orderStatus");

/**
 * Allowed order status transitions (from → to[]).
 * Single source of truth — no scattered switch-cases for legality.
 */
const ORDER_TRANSITIONS = Object.freeze({
  [OrderStatus.PENDING]: Object.freeze([
    OrderStatus.ADMIN_CONFIRMED,
    OrderStatus.REJECTED,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.ADMIN_CONFIRMED]: Object.freeze([
    OrderStatus.COURIER_ASSIGNED,
    OrderStatus.REJECTED,
    OrderStatus.CANCELLED,
  ]),
  /** Legacy ACCEPTED (pre-refactor admin confirm) — treat like pool / early courier */
  [OrderStatus.ACCEPTED]: Object.freeze([
    OrderStatus.COURIER_ASSIGNED,
    OrderStatus.ON_THE_WAY,
    OrderStatus.ARRIVED,
    OrderStatus.REJECTED,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.COURIER_ASSIGNED]: Object.freeze([
    OrderStatus.ON_THE_WAY,
    OrderStatus.ARRIVED,
    OrderStatus.ADMIN_CONFIRMED, // courier decline → re-queue
    OrderStatus.CANCELLED,
    OrderStatus.REJECTED,
  ]),
  [OrderStatus.ON_THE_WAY]: Object.freeze([
    OrderStatus.ARRIVED,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.ARRIVED]: Object.freeze([
    OrderStatus.DELIVERED,
    OrderStatus.ACTIVE,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.DELIVERED]: Object.freeze([
    OrderStatus.ACTIVE,
    OrderStatus.RETURN_REQUESTED,
    OrderStatus.EXPIRED,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.ACTIVE]: Object.freeze([
    OrderStatus.RETURN_REQUESTED,
    OrderStatus.EXPIRED,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.EXPIRED]: Object.freeze([
    OrderStatus.RETURN_REQUESTED,
    OrderStatus.RETURN_ASSIGNED,
  ]),
  [OrderStatus.RETURN_REQUESTED]: Object.freeze([
    OrderStatus.RETURN_ASSIGNED,
    OrderStatus.PICKED_UP, // same courier may collect without re-assign
    OrderStatus.EXPIRED,
  ]),
  [OrderStatus.RETURN_ASSIGNED]: Object.freeze([
    OrderStatus.PICKED_UP,
    OrderStatus.RETURN_REQUESTED, // requeue
  ]),
  [OrderStatus.PICKED_UP]: Object.freeze([
    OrderStatus.COMPLETED,
    OrderStatus.RETURNED,
  ]),
  [OrderStatus.RETURNED]: Object.freeze([OrderStatus.COMPLETED]),
  [OrderStatus.COMPLETED]: Object.freeze([]),
  [OrderStatus.CANCELLED]: Object.freeze([]),
  [OrderStatus.REJECTED]: Object.freeze([]),
});

const TERMINAL_STATUSES = Object.freeze([
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
]);

/** Pool statuses: waiting for a courier to claim */
const COURIER_POOL_STATUSES = Object.freeze([
  OrderStatus.ADMIN_CONFIRMED,
  OrderStatus.ACCEPTED, // legacy
]);

class OrderStatusError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OrderStatusError";
    this.code = code;
  }
}

function assertTransition(fromStatus, toStatus) {
  const allowed = ORDER_TRANSITIONS[fromStatus];
  if (!allowed) {
    throw new OrderStatusError(
      "UNKNOWN_STATUS",
      `Noma'lum status: ${fromStatus}`
    );
  }
  if (fromStatus === toStatus) {
    return true;
  }
  if (!allowed.includes(toStatus)) {
    throw new OrderStatusError(
      "INVALID_TRANSITION",
      `Status o'tishi taqiqlangan: ${fromStatus} → ${toStatus}`
    );
  }
  return true;
}

function canTransition(fromStatus, toStatus) {
  try {
    assertTransition(fromStatus, toStatus);
    return true;
  } catch {
    return false;
  }
}

function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

function isCourierPoolStatus(status) {
  return COURIER_POOL_STATUSES.includes(status);
}

module.exports = {
  ORDER_TRANSITIONS,
  TERMINAL_STATUSES,
  COURIER_POOL_STATUSES,
  OrderStatusError,
  assertTransition,
  canTransition,
  isTerminal,
  isCourierPoolStatus,
};
