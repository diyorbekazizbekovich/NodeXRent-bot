const EarlyReturnReason = Object.freeze({
  WORK_DONE: "WORK_DONE",
  TRAVEL: "TRAVEL",
  AWAY_FROM_HOME: "AWAY_FROM_HOME",
  NO_LONGER_NEEDED: "NO_LONGER_NEEDED",
  OTHER: "OTHER",
});

const ReturnRequestStatus = Object.freeze({
  PENDING_ADMIN: "PENDING_ADMIN",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
});

const REASON_LABELS_UZ = Object.freeze({
  WORK_DONE: "Ishim tugadi",
  TRAVEL: "Safarga ketaman",
  AWAY_FROM_HOME: "Uyda bo'lmayman",
  NO_LONGER_NEEDED: "Endi kerak emas",
  OTHER: "Boshqa sabab",
});

const WizardStep = Object.freeze({
  REASON: "er:reason",
  CUSTOM_REASON: "er:customReason",
  ADDRESS: "er:address",
  NEW_ADDRESS: "er:newAddress",
  PICKUP_TIME: "er:pickupTime",
  CUSTOM_TIME: "er:customTime",
  CONFIRM: "er:confirm",
});

function labelReason(reason, customReason = null) {
  if (reason === EarlyReturnReason.OTHER && customReason) return customReason;
  return REASON_LABELS_UZ[reason] || reason || "—";
}

module.exports = {
  EarlyReturnReason,
  ReturnRequestStatus,
  REASON_LABELS_UZ,
  WizardStep,
  labelReason,
};
