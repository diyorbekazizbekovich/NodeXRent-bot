/**
 * Audit Log Service — persistence + orchestration.
 * Formatting for Telegram lives in formatter/renderer (SOLID: SRP).
 */
const prisma = require("../config/prisma");
const { formatAuditEntry, registerFormatter } = require("./audit/auditLog.formatter");
const {
  renderDetail,
  renderList,
  detailsKeyboard,
  formatEntry,
} = require("./audit/auditLog.renderer");
const logger = require("../utils/logger");

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
  const entry = await prisma.adminAuditLog.create({
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

  // Server log keeps structured JSON for ops — never sent to Telegram as raw dump
  logger.info("Audit log yozildi", {
    context: "AuditLog",
    id: entry.id,
    action,
    module,
    entityType,
    entityId,
    adminTelegramId: adminTelegramId != null ? String(adminTelegramId) : null,
  });

  return entry;
}

async function recent(limit = 20, { module } = {}) {
  return prisma.adminAuditLog.findMany({
    where: module ? { module } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

async function findById(id) {
  return prisma.adminAuditLog.findUnique({ where: { id: Number(id) } });
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

/**
 * Telegram list payload: human text + details keyboard.
 */
async function buildTelegramList(limit = 15) {
  const logs = await recent(limit);
  if (!logs.length) {
    return { text: "📋 <b>Admin loglar</b>\n\nLoglar yo'q.", options: { parse_mode: "HTML" } };
  }
  return {
    text: renderList(logs),
    options: {
      parse_mode: "HTML",
      ...detailsKeyboard(logs),
    },
  };
}

/**
 * Telegram detail payload for one log id.
 */
async function buildTelegramDetail(id) {
  const entry = await findById(id);
  if (!entry) return null;
  return {
    text: renderDetail(entry),
    options: { parse_mode: "HTML" },
    entry,
    formatted: formatAuditEntry(entry),
  };
}

module.exports = {
  log,
  recent,
  findById,
  clearAll,
  formatEntry,
  formatAuditEntry,
  registerFormatter,
  renderDetail,
  renderList,
  detailsKeyboard,
  buildTelegramList,
  buildTelegramDetail,
};
