/**
 * Delivery (handover) wizard — persistent step machine.
 * Source of truth is DeliverySession row in DB, not RAM sessionStore.
 */

const DeliveryStep = Object.freeze({
  JOYSTICKS: "JOYSTICKS",
  HDMI: "HDMI",
  POWER: "POWER",
  COLLATERAL: "COLLATERAL",
  COLLATERAL_CONFIRM: "COLLATERAL_CONFIRM",
  PAYMENT: "PAYMENT",
  PHOTO: "PHOTO",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
});

const DeliverySessionStatus = Object.freeze({
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
});

/** Thin RAM pointer for photo message routing only (optional cache). */
const PHOTO_RAM_STEP = "hw:photo";

function joystickIdsOf(session) {
  const raw = session?.selectedJoystickIds;
  if (Array.isArray(raw)) return raw.map(Number).filter(Number.isFinite);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

/**
 * Accessories ready for collateral/payment/photo steps.
 * Console InventoryItem is NOT required — InventoryUnit is on the Order.
 */
function hasAccessoryKit(session) {
  const js = joystickIdsOf(session);
  return (
    js.length === 4 &&
    session?.selectedHdmiId != null &&
    session?.selectedPowerId != null
  );
}

function hasUnitBound(session, order) {
  const unitId = session?.inventoryUnitId || order?.inventoryUnitId;
  return unitId != null;
}

module.exports = {
  DeliveryStep,
  DeliverySessionStatus,
  PHOTO_RAM_STEP,
  joystickIdsOf,
  hasAccessoryKit,
  hasUnitBound,
};
