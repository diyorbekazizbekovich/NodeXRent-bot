/**
 * Audit action catalog — titles/icons for Telegram (DB still stores raw action strings).
 */
const AuditAction = Object.freeze({
  FACTORY_RESET_EXECUTED: "FACTORY_RESET_EXECUTED",
  ORDER_ADMIN_CONFIRMED: "ORDER_ADMIN_CONFIRMED",
  ORDER_STATUS_CHANGED: "ORDER_STATUS_CHANGED",
  ORDER_REJECTED: "ORDER_REJECTED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  PROMO_CREATED: "PROMO_CREATED",
  PROMO_UPDATED: "PROMO_UPDATED",
  PROMO_DELETED: "PROMO_DELETED",
  DATABASE_BACKUP_CREATED: "DATABASE_BACKUP_CREATED",
  AUDIT_LOGS_CLEARED: "AUDIT_LOGS_CLEARED",
  MAINTENANCE_MODE_TOGGLED: "MAINTENANCE_MODE_TOGGLED",
  REALTIME_DASHBOARD_TOGGLED: "REALTIME_DASHBOARD_TOGGLED",
  DELIVERY_FEE_UPDATED: "DELIVERY_FEE_UPDATED",
  DELIVERY_ZONE_UPDATED: "DELIVERY_ZONE_UPDATED",
  INVENTORY_COUNT_UPDATED: "INVENTORY_COUNT_UPDATED",
  INVENTORY_UNIT_UPDATED: "INVENTORY_UNIT_UPDATED",
  CUSTOMER_RATING_UPDATED: "CUSTOMER_RATING_UPDATED",
  CUSTOMER_NOTES_UPDATED: "CUSTOMER_NOTES_UPDATED",
  RENTAL_EXTENSION_APPROVED: "RENTAL_EXTENSION_APPROVED",
  USER_BLOCKED: "USER_BLOCKED",
  USER_UNBLOCKED: "USER_UNBLOCKED",
  ADMIN_LOGIN: "ADMIN_LOGIN",
  BACKUP_RESTORED: "BACKUP_RESTORED",
  INSPECTION_REMINDER_SENT: "INSPECTION_REMINDER_SENT",
});

/** @type {Record<string, { icon: string, title: string }>} */
const AUDIT_ACTION_META = Object.freeze({
  [AuditAction.FACTORY_RESET_EXECUTED]: { icon: "🗑", title: "Factory Reset" },
  [AuditAction.ORDER_ADMIN_CONFIRMED]: { icon: "✅", title: "Buyurtma tasdiqlandi" },
  [AuditAction.ORDER_STATUS_CHANGED]: { icon: "🔄", title: "Buyurtma statusi o'zgardi" },
  [AuditAction.ORDER_REJECTED]: { icon: "❌", title: "Buyurtma rad etildi" },
  [AuditAction.ORDER_CANCELLED]: { icon: "🚫", title: "Buyurtma bekor qilindi" },
  [AuditAction.PROMO_CREATED]: { icon: "🏷️", title: "Promo yaratildi" },
  [AuditAction.PROMO_UPDATED]: { icon: "🏷️", title: "Promo yangilandi" },
  [AuditAction.PROMO_DELETED]: { icon: "🏷️", title: "Promo o'chirildi" },
  [AuditAction.DATABASE_BACKUP_CREATED]: { icon: "💾", title: "Backup yaratildi" },
  [AuditAction.BACKUP_RESTORED]: { icon: "💾", title: "Backup tiklandi" },
  [AuditAction.AUDIT_LOGS_CLEARED]: { icon: "🧹", title: "Audit loglar tozalandi" },
  [AuditAction.MAINTENANCE_MODE_TOGGLED]: { icon: "🚧", title: "Maintenance rejimi" },
  [AuditAction.REALTIME_DASHBOARD_TOGGLED]: { icon: "🔄", title: "Real-time dashboard" },
  [AuditAction.DELIVERY_FEE_UPDATED]: { icon: "🚚", title: "Yetkazib berish narxi" },
  [AuditAction.DELIVERY_ZONE_UPDATED]: { icon: "📍", title: "Yetkazib berish zonasi" },
  [AuditAction.INVENTORY_COUNT_UPDATED]: { icon: "🎮", title: "Inventar soni" },
  [AuditAction.INVENTORY_UNIT_UPDATED]: { icon: "🎮", title: "Qurilma yangilandi" },
  [AuditAction.CUSTOMER_RATING_UPDATED]: { icon: "⭐", title: "Mijoz reytingi" },
  [AuditAction.CUSTOMER_NOTES_UPDATED]: { icon: "📝", title: "Mijoz izohi" },
  [AuditAction.RENTAL_EXTENSION_APPROVED]: { icon: "⏱", title: "Ijara uzaytirildi" },
  [AuditAction.USER_BLOCKED]: { icon: "🔒", title: "Foydalanuvchi bloklandi" },
  [AuditAction.USER_UNBLOCKED]: { icon: "🔓", title: "Blokdan chiqarildi" },
  [AuditAction.ADMIN_LOGIN]: { icon: "👤", title: "Admin login" },
  [AuditAction.INSPECTION_REMINDER_SENT]: { icon: "🔔", title: "Tekshiruv eslatmasi" },
});

function getActionMeta(action) {
  return (
    AUDIT_ACTION_META[action] || {
      icon: "📋",
      title: humanizeAction(action),
    }
  );
}

function humanizeAction(action) {
  if (!action) return "Noma'lum amal";
  return String(action)
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

module.exports = {
  AuditAction,
  AUDIT_ACTION_META,
  getActionMeta,
  humanizeAction,
};
