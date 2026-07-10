const PaymentStatus = {
  UNPAID: "UNPAID",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  PENDING: "PENDING",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
};

const PaymentMethod = {
  CASH: "CASH",
  CLICK: "CLICK",
  CARD: "CARD",
};

const LABELS_UZ = {
  UNPAID: "To'lanmagan",
  PARTIAL: "Qisman to'langan",
  PAID: "To'langan",
  PENDING: "Kutilmoqda",
  FAILED: "Muvaffaqiyatsiz",
  REFUNDED: "Qaytarilgan",
};

const METHOD_LABELS_UZ = {
  CASH: "Naqd",
  CLICK: "Click",
  CARD: "Karta",
};

function labelStatus(s) {
  return LABELS_UZ[s] || s;
}

function labelMethod(m) {
  return METHOD_LABELS_UZ[m] || m;
}

module.exports = { PaymentStatus, PaymentMethod, labelStatus, labelMethod };
