const OrderStatus = {
  PENDING: "PENDING",
  COURIER_ASSIGNED: "COURIER_ASSIGNED",
  ACCEPTED: "ACCEPTED",
  ON_THE_WAY: "ON_THE_WAY",
  ARRIVED: "ARRIVED",
  DELIVERED: "DELIVERED",
  RETURN_REQUESTED: "RETURN_REQUESTED",
  RETURNED: "RETURNED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
};

const STATUS_LABELS_UZ = {
  PENDING: "Kutilayotgan",
  COURIER_ASSIGNED: "Kuryer biriktirildi",
  ACCEPTED: "Qabul qilingan",
  ON_THE_WAY: "Yo'lda",
  ARRIVED: "Yetib keldi",
  DELIVERED: "Yetkazib berilgan",
  RETURN_REQUESTED: "Qaytarish so'raldi",
  RETURNED: "PlayStation qaytarib olindi",
  COMPLETED: "Yakunlandi",
  CANCELLED: "Bekor qilingan",
  EXPIRED: "Muddati tugagan",
};

const ADMIN_FILTER_GROUPS = [
  { key: "PENDING", label: "Kutilayotgan", statuses: ["PENDING"] },
  {
    key: "ACCEPTED",
    label: "Qabul qilingan",
    statuses: ["COURIER_ASSIGNED", "ACCEPTED", "ON_THE_WAY", "ARRIVED"],
  },
  { key: "DELIVERED", label: "Yetkazib berilgan", statuses: ["DELIVERED"] },
  {
    key: "RENTING",
    label: "Ijarada",
    statuses: ["DELIVERED"],
  },
  { key: "RETURNED", label: "PlayStation qaytarib olindi", statuses: ["RETURNED", "COMPLETED"] },
  { key: "CANCELLED", label: "Bekor qilingan", statuses: ["CANCELLED", "EXPIRED"] },
];

const REVENUE_STATUSES = ["COMPLETED", "RETURNED", "DELIVERED"];

const ACTIVE_RENTAL_STATUSES = ["DELIVERED", "RETURN_REQUESTED"];

const TIMELINE_LABELS = {
  PENDING: "Buyurtma yaratildi",
  COURIER_ASSIGNED: "Kuryer biriktirildi",
  ACCEPTED: "Kuryer qabul qildi",
  ON_THE_WAY: "Kuryer yo'lga chiqdi",
  ARRIVED: "Kuryer yetib keldi",
  DELIVERED: "Yetkazildi — ijara davom etmoqda",
  RETURN_REQUESTED: "Qaytarish so'raldi",
  RETURNED: "PlayStation qaytarib olindi",
  COMPLETED: "Yakunlandi",
  CANCELLED: "Bekor qilindi",
  EXPIRED: "Muddati tugadi",
};

function label(status) {
  return STATUS_LABELS_UZ[status] || status;
}

function filterGroup(key) {
  return ADMIN_FILTER_GROUPS.find((g) => g.key === key);
}

module.exports = {
  OrderStatus,
  STATUS_LABELS_UZ,
  ADMIN_FILTER_GROUPS,
  REVENUE_STATUSES,
  ACTIVE_RENTAL_STATUSES,
  TIMELINE_LABELS,
  label,
  filterGroup,
};
