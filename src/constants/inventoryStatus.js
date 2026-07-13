const STATUS_LABELS_UZ = {
  AVAILABLE: "Bo'sh",
  RESERVED: "Band (bron)",
  RENTED: "Ijarada",
  MAINTENANCE: "Ta'mirda",
  MISSING_PARTS: "Ehtiyot qism yo'q",
  DEFECTIVE: "Nosoz",
};

function label(status) {
  return STATUS_LABELS_UZ[status] || status;
}

module.exports = { STATUS_LABELS_UZ, label };
