const CustomerRating = {
  TRUSTED: "TRUSTED",
  NORMAL: "NORMAL",
  RISKY: "RISKY",
};

const LABELS_UZ = {
  TRUSTED: "Ishonchli",
  NORMAL: "Oddiy",
  RISKY: "Xavfli",
};

function label(rating) {
  return LABELS_UZ[rating] || rating;
}

module.exports = { CustomerRating, LABELS_UZ, label };
