/**
 * Audit Channel event types & display aliases.
 */
const AuditChannelEvent = Object.freeze({
  DELIVERY_COMPLETED: "DELIVERY_COMPLETED",
  RETURN_PICKED_UP: "RETURN_PICKED_UP",
  INSPECTION_COMPLETED: "INSPECTION_COMPLETED",
});

const AuditChannelStatus = Object.freeze({
  PENDING: "PENDING",
  SENT: "SENT",
  PARTIAL: "PARTIAL", // text sent, photo failed
  FAILED: "FAILED",
});

const HASHTAG = Object.freeze({
  [AuditChannelEvent.DELIVERY_COMPLETED]: "#topshirildi",
  [AuditChannelEvent.RETURN_PICKED_UP]: "#qaytarildi",
  [AuditChannelEvent.INSPECTION_COMPLETED]: "#tekshiruv",
});

/** Business labels for channel posts */
function displayInventoryStatus(status) {
  if (!status) return "—";
  if (status === "RENTED") return "UNDER_INSPECTION";
  if (status === "INSPECTION") return "UNDER_INSPECTION";
  if (status === "MAINTENANCE") return "UNDER_REPAIR";
  return status;
}

module.exports = {
  AuditChannelEvent,
  AuditChannelStatus,
  HASHTAG,
  displayInventoryStatus,
};
