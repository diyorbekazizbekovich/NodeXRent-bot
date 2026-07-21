/**
 * Lightweight in-process domain event bus.
 * Handlers must never roll back committed DB work — notify failures are isolated.
 */
const { EventEmitter } = require("events");
const logger = require("../utils/logger");

const DomainEvents = Object.freeze({
  ORDER_PICKED_UP: "ORDER_PICKED_UP",
  ORDER_INSPECTION_STARTED: "ORDER_INSPECTION_STARTED",
  ORDER_INSPECTION_COMPLETED: "ORDER_INSPECTION_COMPLETED",
});

const bus = new EventEmitter();
bus.setMaxListeners(50);

function on(event, handler) {
  bus.on(event, async (payload) => {
    try {
      await handler(payload);
    } catch (err) {
      logger.error("Domain event handler failed", {
        context: "DomainBus",
        event,
        error: err.message,
        stack: err.stack,
        orderId: payload?.orderId,
      });
    }
  });
}

/**
 * Fire-and-forget after the calling stack (and TX) has finished.
 * Uses setImmediate so Prisma commit is fully settled before side-effects.
 */
function emitAfterCommit(event, payload = {}) {
  setImmediate(() => {
    logger.info("Domain event emitted", {
      context: "DomainBus",
      event,
      orderId: payload?.orderId,
    });
    bus.emit(event, payload);
  });
}

module.exports = {
  DomainEvents,
  on,
  emitAfterCommit,
  bus,
};
