const STATUS_LABELS_UZ = {
  AVAILABLE: "Bo'sh",
  RENTED: "Band",
  MAINTENANCE: "Ta'mirda",
  MISSING_PARTS: "Nosoz",
  DEFECTIVE: "Nosoz",
};

function label(status) {
  return STATUS_LABELS_UZ[status] || status;
}

module.exports = { STATUS_LABELS_UZ, label };
