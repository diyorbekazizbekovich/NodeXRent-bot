const ITEM_TYPES = Object.freeze({
  CONSOLE: "CONSOLE",
  JOYSTICK: "JOYSTICK",
  HDMI: "HDMI",
  POWER: "POWER",
});

const ITEM_STATUSES = Object.freeze({
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  RENTED: "RENTED",
  MAINTENANCE: "MAINTENANCE",
});

const CONDITIONS = Object.freeze({
  IDEAL: "IDEAL",
  GOOD: "GOOD",
  MINOR_ISSUE: "MINOR_ISSUE",
  SERIOUS_ISSUE: "SERIOUS_ISSUE",
});

const CONDITION_LABELS_UZ = {
  IDEAL: "Ideal",
  GOOD: "Yaxshi",
  MINOR_ISSUE: "Mayda nosoz",
  SERIOUS_ISSUE: "Jiddiy nosoz",
};

const ITEM_TYPE_LABELS_UZ = {
  CONSOLE: "PlayStation",
  JOYSTICK: "Joystick",
  HDMI: "HDMI kabel",
  POWER: "Power kabel",
};

const ITEM_STATUS_LABELS_UZ = {
  AVAILABLE: "Bo'sh",
  RESERVED: "Band (reserved)",
  RENTED: "Ijarada",
  MAINTENANCE: "Ta'mirda",
};

function labelCondition(c) {
  return CONDITION_LABELS_UZ[c] || c || "—";
}

function labelItemType(t) {
  return ITEM_TYPE_LABELS_UZ[t] || t || "—";
}

function labelItemStatus(s) {
  return ITEM_STATUS_LABELS_UZ[s] || s || "—";
}

module.exports = {
  ITEM_TYPES,
  ITEM_STATUSES,
  CONDITIONS,
  CONDITION_LABELS_UZ,
  ITEM_TYPE_LABELS_UZ,
  ITEM_STATUS_LABELS_UZ,
  labelCondition,
  labelItemType,
  labelItemStatus,
};
