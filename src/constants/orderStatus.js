const OrderStatus = {
  PENDING: "PENDING",
  ADMIN_CONFIRMED: "ADMIN_CONFIRMED",
  COURIER_ASSIGNED: "COURIER_ASSIGNED",
  /** @deprecated Prefer ADMIN_CONFIRMED; kept for legacy rows */
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  ON_THE_WAY: "ON_THE_WAY",
  ARRIVED: "ARRIVED",
  DELIVERED: "DELIVERED",
  /** Product term: ACTIVE_RENTAL */
  ACTIVE: "ACTIVE",
  ACTIVE_RENTAL: "ACTIVE",
  RETURN_REQUESTED: "RETURN_REQUESTED",
  RETURN_ASSIGNED: "RETURN_ASSIGNED",
  PICKED_UP: "PICKED_UP",
  RETURNED: "RETURNED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
};

const STATUS_LABELS_UZ = {
  PENDING: "Kutilayotgan (admin)",
  ADMIN_CONFIRMED: "Admin tasdiqlagan — kuryer navbati",
  COURIER_ASSIGNED: "Kuryer biriktirildi",
  ACCEPTED: "Qabul qilingan (eski)",
  REJECTED: "Rad etilgan",
  ON_THE_WAY: "Yo'lda",
  ARRIVED: "Yetib keldi",
  DELIVERED: "Yetkazib berilgan",
  ACTIVE: "Faol ijara",
  RETURN_REQUESTED: "Qaytarish so'raldi",
  RETURN_ASSIGNED: "Qaytarish uchun kuryer biriktirildi",
  PICKED_UP: "Kuryer olib oldi — admin tekshiruvi",
  RETURNED: "PlayStation qaytarib olindi",
  COMPLETED: "Yakunlandi",
  CANCELLED: "Bekor qilingan",
  EXPIRED: "Muddati tugagan",
};

const ADMIN_FILTER_GROUPS = [
  { key: "PENDING", label: "Kutilayotgan", statuses: ["PENDING"] },
  {
    key: "ADMIN_CONFIRMED",
    label: "Admin tasdiqlagan",
    statuses: ["ADMIN_CONFIRMED", "ACCEPTED"],
  },
  {
    key: "ACCEPTED",
    label: "Kuryerda",
    statuses: ["COURIER_ASSIGNED", "ON_THE_WAY", "ARRIVED"],
  },
  { key: "DELIVERED", label: "Yetkazib berilgan", statuses: ["DELIVERED", "ACTIVE"] },
  {
    key: "RENTING",
    label: "Ijarada",
    statuses: ["ARRIVED", "DELIVERED", "ACTIVE", "RETURN_REQUESTED", "RETURN_ASSIGNED", "EXPIRED"],
  },
  {
    key: "RETURN",
    label: "Qaytarish / tekshiruv",
    statuses: ["RETURN_REQUESTED", "RETURN_ASSIGNED", "PICKED_UP"],
  },
  { key: "RETURNED", label: "Yakunlangan", statuses: ["RETURNED", "COMPLETED", "PICKED_UP"] },
  { key: "CANCELLED", label: "Bekor qilingan", statuses: ["CANCELLED", "EXPIRED", "REJECTED"] },
];

const REVENUE_STATUSES = ["COMPLETED", "RETURNED", "DELIVERED", "ACTIVE", "PICKED_UP"];

/** Faol ijara: qurilma mijozda (uzaytirish uchun) */
const ACTIVE_RENTAL_STATUSES = ["ARRIVED", "DELIVERED", "ACTIVE"];

/** Courier may show pickup/return wizard only in these statuses */
const COURIER_RETURN_ALLOWED_STATUSES = ["RETURN_REQUESTED", "RETURN_ASSIGNED"];

/**
 * Foydalanuvchida yangi buyurtma yaratishni bloklovchi ochiq statuslar.
 */
const USER_OPEN_ORDER_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.ADMIN_CONFIRMED,
  OrderStatus.COURIER_ASSIGNED,
  OrderStatus.ACCEPTED,
  OrderStatus.ON_THE_WAY,
  OrderStatus.ARRIVED,
  OrderStatus.DELIVERED,
  OrderStatus.ACTIVE,
  OrderStatus.RETURN_REQUESTED,
  OrderStatus.RETURN_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.EXPIRED,
];

/** Qurilma/inventar bo'shatilishi kerak bo'lgan yakuniy statuslar */
const RESOURCE_RELEASE_STATUSES = [
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
  OrderStatus.RETURNED,
  OrderStatus.COMPLETED,
];

/**
 * Mijoz yetkazib berish manzilini yangilashi mumkin bo'lgan statuslar.
 */
const LOCATION_UPDATABLE_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.ADMIN_CONFIRMED,
  OrderStatus.COURIER_ASSIGNED,
  OrderStatus.ACCEPTED,
  OrderStatus.ON_THE_WAY,
  OrderStatus.ARRIVED,
];

const TIMELINE_LABELS = {
  PENDING: "Buyurtma yaratildi",
  ADMIN_CONFIRMED: "Admin tasdiqladi — kuryerlarga yuborildi",
  COURIER_ASSIGNED: "Kuryer qabul qildi",
  ACCEPTED: "Admin tasdiqladi (eski)",
  ON_THE_WAY: "Kuryer yo'lga chiqdi",
  ARRIVED: "Kuryer yetib keldi",
  DELIVERED: "Yetkazildi",
  ACTIVE: "Faol ijara",
  RETURN_REQUESTED: "Qaytarish so'raldi",
  RETURN_ASSIGNED: "Qaytarish uchun kuryer biriktirildi",
  PICKED_UP: "Kuryer olib oldi",
  RETURNED: "PlayStation qaytarib olindi",
  COMPLETED: "Yakunlandi",
  REJECTED: "Rad etildi",
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
  COURIER_RETURN_ALLOWED_STATUSES,
  USER_OPEN_ORDER_STATUSES,
  RESOURCE_RELEASE_STATUSES,
  LOCATION_UPDATABLE_STATUSES,
  TIMELINE_LABELS,
  label,
  filterGroup,
};
