/**
 * Domain-event → Audit Channel posts (post-commit, never blocks business).
 */
const { DomainEvents, on } = require("../domainBus");
const auditChannel = require("../../services/auditChannel/auditChannel.service");
const logger = require("../../utils/logger");

async function onHandoverCompleted(payload) {
  logger.info("AUDIT_CHANNEL_HANDOVER_STARTED", {
    context: "AuditChannelHandler",
    orderId: payload?.orderId,
  });
  await auditChannel.postDeliveryCompleted(payload.orderId, payload.meta || {});
}

async function onOrderPickedUp(payload) {
  logger.info("AUDIT_CHANNEL_RETURN_STARTED", {
    context: "AuditChannelHandler",
    orderId: payload?.orderId,
  });
  await auditChannel.postReturnPickedUp(payload.orderId, {
    photoFileId: payload.photoFileId || null,
  });
}

async function onInspectionCompleted(payload) {
  logger.info("AUDIT_CHANNEL_INSPECTION_STARTED", {
    context: "AuditChannelHandler",
    orderId: payload?.orderId,
  });
  await auditChannel.postInspectionCompleted(payload.orderId, {
    outcome: payload.outcome,
    note: payload.note,
    fineAmount: payload.fineAmount || 0,
    adminId: payload.adminId,
    itemResults: payload.itemResults,
  });
}

function registerAuditChannelHandlers() {
  on(DomainEvents.ORDER_HANDOVER_COMPLETED, onHandoverCompleted);
  on(DomainEvents.ORDER_PICKED_UP, onOrderPickedUp);
  on(DomainEvents.ORDER_INSPECTION_COMPLETED, onInspectionCompleted);
  logger.info("Audit channel handlers registered", { context: "AuditChannelHandler" });
}

module.exports = {
  registerAuditChannelHandlers,
  onHandoverCompleted,
  onOrderPickedUp,
  onInspectionCompleted,
};
