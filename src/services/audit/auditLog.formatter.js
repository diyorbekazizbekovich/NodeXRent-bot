/**
 * Audit Log Formatter — maps raw DB entries to structured, human-readable fields.
 * Never returns JSON strings for Telegram display.
 */
const { getActionMeta, AuditAction } = require("../../constants/auditActions");

/**
 * @typedef {object} FormattedAuditLog
 * @property {number} id
 * @property {string} action
 * @property {string} icon
 * @property {string} title
 * @property {string|null} module
 * @property {string} adminLabel
 * @property {string|null} telegramId
 * @property {string} date
 * @property {string} time
 * @property {string} summary  Short one-liner for list view
 * @property {string[]} detailLines  Bullet / section lines for detail view
 * @property {number|null} entityId
 * @property {string|null} entityType
 */

function asObject(value) {
  if (value == null) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  return {};
}

function formatAdminLabel(entry) {
  if (entry.adminTelegramId != null) {
    return `@admin`;
  }
  return "Tizim / Admin";
}

function formatTelegramId(entry) {
  if (entry.adminTelegramId == null) return null;
  return String(entry.adminTelegramId);
}

function formatDateParts(createdAt) {
  const { formatDate } = require("../../utils/dateHelper");
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(d.getTime())) {
    return { date: "—", time: "—" };
  }
  const date = formatDate(d);
  const time = d.toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  });
  return { date, time };
}

function boolLabel(v) {
  if (v === true) return "YOQILGAN";
  if (v === false) return "O'CHIRILGAN";
  return "—";
}

function money(n) {
  if (n == null || n === "") return "—";
  return `${Number(n).toLocaleString("uz-UZ")} so'm`;
}

function countLine(label, value) {
  if (value == null) return null;
  return `• ${label}: ${Number(value)} ta`;
}

/** Factory reset counts → readable bullets */
function formatFactoryResetCounts(counts = {}) {
  const map = [
    ["Foydalanuvchilar", counts.users],
    ["Buyurtmalar", counts.orders],
    ["To'lovlar", counts.payments],
    ["Shartnomalar", counts.contracts],
    ["Bildirishnomalar", counts.notifications],
    ["Buyurtma fotolari", counts.orderPhotos],
    ["Status loglari", counts.statusLogs],
    ["Uzaytirishlar", counts.extensions],
    ["Reviewlar", counts.reviews],
    ["Support xabarlar", counts.supportMessages],
    ["Support threadlar", counts.supportThreads],
    ["Promo-kodlar", counts.promocodes],
    ["Kampaniyalar", counts.campaigns],
    ["Inventar tarixi", counts.invItemHistory],
    ["Unit tarixi", counts.invUnitHistory],
    ["Inventory", counts.invItemsReset],
    ["Qurilmalar", counts.invUnitsReset ?? counts.playstationsReset],
    ["PlayStationlar (reset)", counts.playstationsReset],
    ["Eski audit loglar", counts.auditLogs],
    ["Backup yozuvlari", counts.backups],
    ["Order items", counts.orderItems],
  ];

  return map.map(([label, v]) => countLine(label, v)).filter(Boolean);
}

function base(entry) {
  const meta = getActionMeta(entry.action);
  const { date, time } = formatDateParts(entry.createdAt);
  return {
    id: entry.id,
    action: entry.action,
    icon: meta.icon,
    title: meta.title,
    module: entry.module || null,
    adminLabel: formatAdminLabel(entry),
    telegramId: formatTelegramId(entry),
    date,
    time,
    entityId: entry.entityId ?? null,
    entityType: entry.entityType || null,
    summary: meta.title,
    detailLines: [],
  };
}

const FORMATTERS = {
  [AuditAction.FACTORY_RESET_EXECUTED](entry) {
    const after = asObject(entry.afterData);
    const counts = asObject(after.counts);
    const lines = formatFactoryResetCounts(counts);
    const totalDeleted = Object.values(counts).reduce((s, v) => s + (Number(v) || 0), 0);
    const out = base(entry);
    out.summary = `O'chirilgan / reset: ${totalDeleted} yozuv`;
    out.detailLines = ["📊 O'chirilgan ma'lumotlar:", ...lines];
    if (Array.isArray(after.preserveTelegramIds) && after.preserveTelegramIds.length) {
      out.detailLines.push("", "🛡 Saqlangan Telegram ID:");
      after.preserveTelegramIds.forEach((id) => out.detailLines.push(`• ${id}`));
    }
    return out;
  },

  [AuditAction.ORDER_ADMIN_CONFIRMED](entry) {
    const out = base(entry);
    const after = asObject(entry.afterData);
    out.summary = `Buyurtma #${entry.entityId || "—"} → ${after.status || "ADMIN_CONFIRMED"}`;
    out.detailLines = [
      `📦 Buyurtma: #${entry.entityId || "—"}`,
      `📌 Yangi status: ${after.status || "ADMIN_CONFIRMED"}`,
    ];
    return out;
  },

  [AuditAction.ORDER_STATUS_CHANGED](entry) {
    const out = base(entry);
    const before = asObject(entry.beforeData);
    const after = asObject(entry.afterData);
    const from = before.status || before.fromStatus || "—";
    const to = after.toStatus || after.status || "—";
    out.summary = `Buyurtma #${entry.entityId || "—"}: ${from} → ${to}`;
    out.detailLines = [
      `📦 Buyurtma: #${entry.entityId || "—"}`,
      `📌 Status: ${from} → ${to}`,
    ];
    if (after.actorType) out.detailLines.push(`👤 Actor: ${after.actorType}`);
    if (after.note) out.detailLines.push(`📝 Izoh: ${String(after.note).slice(0, 200)}`);
    return out;
  },

  [AuditAction.ORDER_REJECTED](entry) {
    const out = base(entry);
    const after = asObject(entry.afterData);
    out.summary = after.message || `Buyurtma #${entry.entityId} rad etildi`;
    out.detailLines = [
      `📦 Buyurtma: #${entry.entityId || "—"}`,
      after.message ? `📝 ${after.message}` : "📝 Admin buyurtmani rad etdi",
    ];
    return out;
  },

  [AuditAction.ORDER_CANCELLED](entry) {
    const out = base(entry);
    const after = asObject(entry.afterData);
    out.summary = after.message || `Buyurtma #${entry.entityId} bekor qilindi`;
    out.detailLines = [
      `📦 Buyurtma: #${entry.entityId || "—"}`,
      after.message ? `📝 ${after.message}` : "📝 Admin buyurtmani bekor qildi",
    ];
    return out;
  },

  [AuditAction.PROMO_CREATED](entry) {
    const out = base(entry);
    const after = asObject(entry.afterData);
    out.summary = `Kod: ${after.code || "—"}`;
    out.detailLines = [
      `🏷️ Kod: ${after.code || "—"}`,
      entry.entityId ? `🆔 Promo ID: ${entry.entityId}` : null,
    ].filter(Boolean);
    return out;
  },

  [AuditAction.PROMO_UPDATED](entry) {
    const out = base(entry);
    const before = asObject(entry.beforeData);
    const after = asObject(entry.afterData);
    out.summary = `${before.code || after.code || "—"} · faol: ${boolLabel(after.isActive)}`;
    out.detailLines = [
      `🏷️ Kod: ${after.code || before.code || "—"}`,
      `Holat (oldin): ${boolLabel(before.isActive)}`,
      `Holat (keyin): ${boolLabel(after.isActive)}`,
    ];
    return out;
  },

  [AuditAction.PROMO_DELETED](entry) {
    const out = base(entry);
    const after = asObject(entry.afterData);
    out.summary = `Kod: ${after.code || "—"}`;
    out.detailLines = [`🏷️ O'chirilgan kod: ${after.code || "—"}`];
    return out;
  },

  [AuditAction.DATABASE_BACKUP_CREATED](entry) {
    const out = base(entry);
    const after = asObject(entry.afterData);
    const size = after.size != null ? `${Number(after.size).toLocaleString("uz-UZ")} bayt` : "—";
    out.summary = after.filename || "Backup";
    out.detailLines = [
      `📁 Fayl: ${after.filename || "—"}`,
      `📦 Hajm: ${size}`,
      entry.entityId ? `🆔 Backup ID: ${entry.entityId}` : null,
    ].filter(Boolean);
    return out;
  },

  [AuditAction.BACKUP_RESTORED](entry) {
    const out = base(entry);
    const after = asObject(entry.afterData);
    out.summary = after.filename || "Backup tiklandi";
    out.detailLines = [`📁 Fayl: ${after.filename || "—"}`];
    return out;
  },

  [AuditAction.AUDIT_LOGS_CLEARED](entry) {
    const out = base(entry);
    const after = asObject(entry.afterData);
    out.summary = `${after.deletedCount ?? 0} ta log o'chirildi`;
    out.detailLines = [`🧹 O'chirilgan loglar: ${after.deletedCount ?? 0} ta`];
    return out;
  },

  [AuditAction.MAINTENANCE_MODE_TOGGLED](entry) {
    const out = base(entry);
    const before = asObject(entry.beforeData);
    const after = asObject(entry.afterData);
    out.summary = `${boolLabel(before.enabled)} → ${boolLabel(after.enabled)}`;
    out.detailLines = [
      `🚧 Oldin: ${boolLabel(before.enabled)}`,
      `🚧 Keyin: ${boolLabel(after.enabled)}`,
    ];
    return out;
  },

  [AuditAction.REALTIME_DASHBOARD_TOGGLED](entry) {
    const out = base(entry);
    const before = asObject(entry.beforeData);
    const after = asObject(entry.afterData);
    out.summary = `${boolLabel(before.enabled)} → ${boolLabel(after.enabled)}`;
    out.detailLines = [
      `🔄 Oldin: ${boolLabel(before.enabled)}`,
      `🔄 Keyin: ${boolLabel(after.enabled)}`,
    ];
    return out;
  },

  [AuditAction.DELIVERY_FEE_UPDATED](entry) {
    const out = base(entry);
    const before = asObject(entry.beforeData);
    const after = asObject(entry.afterData);
    out.summary = `${money(before.deliveryFee)} → ${money(after.deliveryFee)}`;
    out.detailLines = [
      `🚚 Oldin: ${money(before.deliveryFee)}`,
      `🚚 Keyin: ${money(after.deliveryFee)}`,
    ];
    return out;
  },

  [AuditAction.DELIVERY_ZONE_UPDATED](entry) {
    const out = base(entry);
    const after = asObject(entry.afterData);
    out.summary = `${after.code || "—"} · ${money(after.fee)}`;
    out.detailLines = [
      `📍 Kod: ${after.code || "—"}`,
      `🏷 Nom: ${after.name || "—"}`,
      `💰 Narx: ${money(after.fee)}`,
    ];
    return out;
  },

  [AuditAction.INVENTORY_COUNT_UPDATED](entry) {
    const out = base(entry);
    const before = asObject(entry.beforeData);
    const after = asObject(entry.afterData);
    const type = after.consoleType || before.consoleType || "PS";
    out.summary = `${type}: ${before.count ?? "?"} → ${after.count ?? "?"}`;
    out.detailLines = [
      `🎮 Model: ${type}`,
      `📊 Oldin: ${before.count ?? "—"}`,
      `📊 Keyin: ${after.count ?? "—"}`,
    ];
    if (after.message) out.detailLines.push(`📝 ${String(after.message).slice(0, 200)}`);
    return out;
  },

  [AuditAction.INVENTORY_UNIT_UPDATED](entry) {
    const out = base(entry);
    const before = asObject(entry.beforeData);
    const after = asObject(entry.afterData);
    out.summary = `Unit #${entry.entityId || "—"}: ${before.status || "—"} → ${after.status || "—"}`;
    out.detailLines = [
      `🆔 Unit ID: ${entry.entityId || "—"}`,
      `📌 Status: ${before.status || "—"} → ${after.status || "—"}`,
    ];
    if (after.adminNote != null) {
      out.detailLines.push(`📝 Izoh: ${String(after.adminNote).slice(0, 200) || "—"}`);
    }
    return out;
  },

  [AuditAction.CUSTOMER_RATING_UPDATED](entry) {
    const out = base(entry);
    const before = asObject(entry.beforeData);
    const after = asObject(entry.afterData);
    out.summary = `User #${entry.entityId}: ${before.customerRating || "—"} → ${after.customerRating || "—"}`;
    out.detailLines = [
      `👤 User ID: ${entry.entityId || "—"}`,
      `⭐ Reyting: ${before.customerRating || "—"} → ${after.customerRating || "—"}`,
    ];
    return out;
  },

  [AuditAction.CUSTOMER_NOTES_UPDATED](entry) {
    const out = base(entry);
    const after = asObject(entry.afterData);
    const note = String(after.adminNotes || "").slice(0, 120);
    out.summary = `User #${entry.entityId} · izoh yangilandi`;
    out.detailLines = [
      `👤 User ID: ${entry.entityId || "—"}`,
      `📝 Izoh: ${note || "—"}`,
    ];
    return out;
  },

  [AuditAction.RENTAL_EXTENSION_APPROVED](entry) {
    const out = base(entry);
    const after = asObject(entry.afterData);
    out.summary = `Order #${after.orderId || entry.entityId || "—"}`;
    out.detailLines = [
      `📦 Buyurtma: #${after.orderId || "—"}`,
      `⏱ Qo'shimcha soat: ${after.extraHours ?? "—"}`,
      after.extraPrice != null ? `💰 Narx: ${money(after.extraPrice)}` : null,
    ].filter(Boolean);
    return out;
  },

  [AuditAction.USER_BLOCKED](entry) {
    const out = base(entry);
    out.summary = `User #${entry.entityId || "—"} bloklandi`;
    out.detailLines = [`👤 User ID: ${entry.entityId || "—"}`];
    return out;
  },

  [AuditAction.USER_UNBLOCKED](entry) {
    const out = base(entry);
    out.summary = `User #${entry.entityId || "—"} blokdan chiqarildi`;
    out.detailLines = [`👤 User ID: ${entry.entityId || "—"}`];
    return out;
  },

  [AuditAction.ADMIN_LOGIN](entry) {
    const out = base(entry);
    out.summary = "Admin tizimga kirdi";
    out.detailLines = ["👤 Admin sessiyasi boshlandi"];
    return out;
  },
};

/**
 * Safe generic formatter — never dumps JSON.
 */
function formatGeneric(entry) {
  const out = base(entry);
  const before = asObject(entry.beforeData);
  const after = asObject(entry.afterData);

  if (after.message) {
    out.summary = String(after.message).slice(0, 120);
    out.detailLines = [`📝 ${String(after.message).slice(0, 500)}`];
    return out;
  }

  const lines = [];
  if (entry.entityType || entry.entityId != null) {
    lines.push(`🔗 ${entry.entityType || "Entity"}: #${entry.entityId ?? "—"}`);
  }

  const changedKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (k) => k !== "message"
  );

  if (changedKeys.length) {
    lines.push("📊 O'zgarishlar:");
    for (const key of changedKeys.slice(0, 12)) {
      const b = before[key];
      const a = after[key];
      if (b !== undefined && a !== undefined && b !== a) {
        lines.push(`• ${labelKey(key)}: ${stringifySafe(b)} → ${stringifySafe(a)}`);
      } else if (a !== undefined && b === undefined) {
        lines.push(`• ${labelKey(key)}: ${stringifySafe(a)}`);
      } else if (b !== undefined && a === undefined) {
        lines.push(`• ${labelKey(key)} (oldingi): ${stringifySafe(b)}`);
      }
    }
  } else {
    lines.push("• Qo'shimcha tafsilot yo'q");
  }

  out.summary = changedKeys.length
    ? `O'zgarishlar: ${changedKeys.slice(0, 3).map(labelKey).join(", ")}`
    : out.title;
  out.detailLines = lines;
  return out;
}

function labelKey(key) {
  const map = {
    status: "Status",
    toStatus: "Yangi status",
    fromStatus: "Oldingi status",
    enabled: "Holat",
    deliveryFee: "Yetkazib berish",
    code: "Kod",
    isActive: "Faol",
    count: "Soni",
    consoleType: "Model",
    adminNotes: "Izoh",
    customerRating: "Reyting",
    filename: "Fayl",
    size: "Hajm",
    deletedCount: "O'chirilgan",
    orderId: "Buyurtma",
    actorType: "Actor",
    note: "Izoh",
    counts: "Statistika",
  };
  return map[key] || humanizeKey(key);
}

function humanizeKey(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim();
}

/**
 * Primitive-safe display — objects become short labels, never full JSON dumps.
 */
function stringifySafe(value) {
  if (value == null) return "—";
  if (typeof value === "boolean") return boolLabel(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.length > 80 ? `${value.slice(0, 77)}…` : value;
  if (Array.isArray(value)) return `${value.length} ta element`;
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "bo'sh";
    return `${keys.length} ta maydon`;
  }
  return String(value);
}

/**
 * Format a single audit log entry for UI consumption.
 * @param {object} entry Prisma AdminAuditLog
 * @returns {FormattedAuditLog}
 */
function formatAuditEntry(entry) {
  if (!entry) {
    return {
      id: 0,
      action: "UNKNOWN",
      icon: "📋",
      title: "Noma'lum",
      module: null,
      adminLabel: "—",
      telegramId: null,
      date: "—",
      time: "—",
      summary: "—",
      detailLines: [],
      entityId: null,
      entityType: null,
    };
  }

  const fn = FORMATTERS[entry.action] || formatGeneric;
  return fn(entry);
}

/**
 * Register / override a formatter (for extensions).
 */
function registerFormatter(action, formatterFn) {
  FORMATTERS[action] = formatterFn;
}

module.exports = {
  formatAuditEntry,
  registerFormatter,
  formatGeneric,
  FORMATTERS,
};
