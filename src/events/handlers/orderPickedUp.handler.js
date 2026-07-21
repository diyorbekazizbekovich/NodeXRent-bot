/**
 * Post-commit handler: ORDER_PICKED_UP → sendInspectionReminder (initial).
 * Failures are isolated — pickup TX already committed.
 */
const logger = require("../../utils/logger");
const {
  sendInspectionReminder,
  InspectionReminderError,
} = require("../../services/inspectionReminder.service");
const { DomainEvents, on } = require("../domainBus");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function handleOrderPickedUp({ orderId, courierId = null }) {
  logger.info("ADMIN_NOTIFICATION_STARTED", {
    context: "OrderPickedUpHandler",
    event: "ADMIN_NOTIFICATION_STARTED",
    orderId,
  });

  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await sendInspectionReminder(orderId, {
        kind: "initial",
        skipCooldown: true,
        actorType: "system",
        actorId: courierId,
      });
      logger.info("ADMIN_NOTIFICATION_SENT", {
        context: "OrderPickedUpHandler",
        event: "ADMIN_NOTIFICATION_SENT",
        orderId,
        sent: result.sent,
        failed: result.failed,
        attempt,
      });
      return;
    } catch (err) {
      lastErr = err;
      if (err instanceof InspectionReminderError && err.code === "ALREADY_DONE") {
        logger.info("Pickup notify skipped — already done", {
          orderId,
          error: err.message,
        });
        return;
      }
      logger.warn("ADMIN_NOTIFICATION_RETRY", {
        context: "OrderPickedUpHandler",
        orderId,
        attempt,
        error: err.message,
        stack: err.stack,
      });
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  logger.error("ADMIN_NOTIFICATION_FAILED", {
    context: "OrderPickedUpHandler",
    event: "ADMIN_NOTIFICATION_FAILED",
    orderId,
    error: lastErr?.message,
    stack: lastErr?.stack,
  });
}

function registerOrderPickedUpHandler() {
  on(DomainEvents.ORDER_PICKED_UP, handleOrderPickedUp);
}

module.exports = {
  registerOrderPickedUpHandler,
  handleOrderPickedUp,
};
