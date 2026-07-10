const COLLATERAL_TYPES = Object.freeze({
  ID_CARD: "ID_CARD",
  PASSPORT: "PASSPORT",
  NONE: "NONE",
});

const PAYMENT_METHODS_HANDOVER = Object.freeze({
  CASH: "CASH",
  CARD: "CARD",
});

const COLLATERAL_LABELS_UZ = {
  ID_CARD: "ID Karta",
  PASSPORT: "Passport",
  NONE: "Hujjat olinmadi",
};

const PAYMENT_METHOD_LABELS_UZ = {
  CASH: "Naqd",
  CARD: "Karta",
  CLICK: "Click",
};

function labelCollateral(type) {
  return COLLATERAL_LABELS_UZ[type] || type || "—";
}

function labelHandoverPayment(method) {
  return PAYMENT_METHOD_LABELS_UZ[method] || method || "—";
}

module.exports = {
  COLLATERAL_TYPES,
  PAYMENT_METHODS_HANDOVER,
  COLLATERAL_LABELS_UZ,
  PAYMENT_METHOD_LABELS_UZ,
  labelCollateral,
  labelHandoverPayment,
};
