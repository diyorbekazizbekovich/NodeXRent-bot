const prisma = require("../config/prisma");
const { formatDatetime, formatDate } = require("../utils/dateHelper");

async function log({
  adminId,
  adminTelegramId,
  module,
  action,
  entityType,
  entityId,
  beforeData,
  afterData,
}) {
  return prisma.adminAuditLog.create({
    data: {
      adminId: adminId ?? null,
      adminTelegramId: adminTelegramId != null ? BigInt(adminTelegramId) : null,
      module: module ?? null,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      beforeData: beforeData ?? undefined,
      afterData: afterData ?? undefined,
    },
  });
}

async function recent(limit = 20, { module } = {}) {
  return prisma.adminAuditLog.findMany({
    where: module ? { module } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

async function clearAll(adminContext = {}) {
  const count = await prisma.adminAuditLog.count();
  await prisma.adminAuditLog.deleteMany();
  await log({
    module: "AUDIT",
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "AUDIT_LOGS_CLEARED",
    afterData: { deletedCount: count },
  });
  return count;
}

function formatEntry(entry) {
  const d = new Date(entry.createdAt);
  const date = formatDate(d);
  const time = d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
  const who = entry.adminTelegramId ? `@admin (${entry.adminTelegramId})` : "Admin";
  const mod = entry.module ? `[${entry.module}] ` : "";

  let detail = entry.action;
  if (entry.afterData?.message) {
    detail = entry.afterData.message;
  } else if (entry.action === "INVENTORY_COUNT_UPDATED") {
    detail = `${entry.afterData?.consoleType || "PS"} soni\nOldin: ${entry.beforeData?.count ?? "?"}\nKeyin: ${entry.afterData?.count ?? "?"}`;
  } else if (entry.beforeData || entry.afterData) {
    detail = `${JSON.stringify(entry.beforeData || {})} → ${JSON.stringify(entry.afterData || {})}`;
  }

  return (
    `${mod}${detail}\n` +
    `Admin: ${who}\n` +
    `Sana: ${date}\n` +
    `Vaqt: ${time}`
  );
}

module.exports = { log, recent, clearAll, formatEntry };
