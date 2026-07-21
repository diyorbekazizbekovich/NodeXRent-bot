/**
 * Official Audit Channel publisher.
 *
 * Rules:
 *  - Never throw into business flows
 *  - Persist every attempt in audit_logs (ChannelAuditLog)
 *  - Send via bot.sendMessage / sendPhoto to AUDIT_CHANNEL_ID only
 *  - Failures are retriable via retryFailedLogs()
 */
const fs = require("fs");
const env = require("../../config/env");
const prisma = require("../../config/prisma");
const logger = require("../../utils/logger");
const {
  AuditChannelEvent,
  AuditChannelStatus,
} = require("../../constants/auditChannel");
const {
  formatDeliveryCompleted,
  formatReturnPickedUp,
  formatInspectionCompleted,
  photoCaption,
} = require("./auditChannel.formatters");
const { buildInventorySummary } = require("../orderSummary/inventorySummary.service");

function getBotSafe() {
  try {
    const { getBot } = require("../../bot/index");
    return getBot();
  } catch (_) {
    return null;
  }
}

const DETAIL_INCLUDE = {
  user: true,
  courier: true,
  inventoryUnit: true,
  consoleItem: true,
  hdmiItem: true,
  powerItem: true,
  rentalPrice: { include: { consoleCatalog: true } },
  promocode: true,
  payments: true,
  extensions: true,
  orderItems: { include: { inventoryItem: true } },
  photos: true,
  contract: true,
  statusLogs: { orderBy: { changedAt: "asc" } },
};

async function loadOrder(orderId) {
  return prisma.order.findUnique({
    where: { id: Number(orderId) },
    include: DETAIL_INCLUDE,
  });
}

async function resolveConfirmingAdminName(order) {
  const log = (order.statusLogs || []).find((l) => l.status === "ADMIN_CONFIRMED");
  if (!log?.actorId) {
    // Fallback: AdminAuditLog
    const audit = await prisma.adminAuditLog.findFirst({
      where: { entityType: "Order", entityId: order.id, action: "ORDER_ADMIN_CONFIRMED" },
      orderBy: { createdAt: "desc" },
    });
    if (audit?.adminTelegramId) {
      const admin = await prisma.admin.findUnique({
        where: { telegramId: audit.adminTelegramId },
        select: { fullName: true, id: true },
      });
      return admin?.fullName || (admin ? `Admin #${admin.id}` : String(audit.adminTelegramId));
    }
    return null;
  }

  // actorId may be admin.id OR telegram id depending on caller
  let admin = await prisma.admin.findUnique({
    where: { id: log.actorId },
    select: { fullName: true, id: true },
  });
  if (!admin) {
    try {
      admin = await prisma.admin.findUnique({
        where: { telegramId: BigInt(log.actorId) },
        select: { fullName: true, id: true },
      });
    } catch (_) {}
  }
  return admin?.fullName || (admin ? `Admin #${admin.id}` : `Admin #${log.actorId}`);
}

function channelId() {
  return env.AUDIT_CHANNEL_ID;
}

async function createPendingLog({
  eventType,
  orderId,
  courierId,
  adminId,
  customerId,
  payload,
}) {
  return prisma.channelAuditLog.create({
    data: {
      eventType,
      orderId: orderId != null ? Number(orderId) : null,
      courierId: courierId != null ? Number(courierId) : null,
      adminId: adminId != null ? Number(adminId) : null,
      customerId: customerId != null ? Number(customerId) : null,
      status: AuditChannelStatus.PENDING,
      payload: payload ?? undefined,
    },
  });
}

async function markLog(id, data) {
  return prisma.channelAuditLog.update({
    where: { id: Number(id) },
    data,
  });
}

async function sendText(bot, text) {
  return bot.sendMessage(channelId(), text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

async function sendPhoto(bot, { telegramFileId, filePath, caption }) {
  const opts = { caption, parse_mode: "HTML" };
  if (telegramFileId) {
    return bot.sendPhoto(channelId(), telegramFileId, opts);
  }
  if (filePath && fs.existsSync(filePath)) {
    return bot.sendPhoto(channelId(), filePath, opts);
  }
  throw new Error("No photo source (file_id / path)");
}

/**
 * Core post: text + optional photo. Never throws to callers.
 */
async function publish({
  eventType,
  orderId,
  text,
  photo = null,
  courierId = null,
  adminId = null,
  customerId = null,
  payload = null,
}) {
  const chatId = channelId();
  if (!chatId) {
    logger.warn("Audit channel skipped — AUDIT_CHANNEL_ID not set", {
      context: "AuditChannel",
      eventType,
      orderId,
    });
    return null;
  }

  let logRow;
  try {
    logRow = await createPendingLog({
      eventType,
      orderId,
      courierId,
      adminId,
      customerId,
      payload: {
        ...(payload || {}),
        hasPhoto: Boolean(photo),
        textPreview: String(text || "").slice(0, 200),
      },
    });
  } catch (err) {
    logger.error("Audit channel DB create failed", {
      context: "AuditChannel",
      eventType,
      orderId,
      error: err.message,
      stack: err.stack,
    });
    return null;
  }

  const bot = getBotSafe();
  if (!bot) {
    await markLog(logRow.id, {
      status: AuditChannelStatus.FAILED,
      error: "Bot instance not ready",
    }).catch(() => {});
    logger.error("Audit channel failed — bot not ready", {
      context: "AuditChannel",
      eventType,
      orderId,
      logId: logRow.id,
    });
    return logRow;
  }

  let telegramMessageId = null;
  let photoMessageId = null;
  let status = AuditChannelStatus.SENT;
  let error = null;

  try {
    const msg = await sendText(bot, text);
    telegramMessageId = msg?.message_id != null ? BigInt(msg.message_id) : null;
  } catch (err) {
    status = AuditChannelStatus.FAILED;
    error = err.message;
    logger.error("Audit channel sendMessage failed", {
      context: "AuditChannel",
      eventType,
      orderId,
      logId: logRow.id,
      error: err.message,
      stack: err.stack,
    });
  }

  if (status !== AuditChannelStatus.FAILED && photo) {
    try {
      const pmsg = await sendPhoto(bot, {
        telegramFileId: photo.telegramFileId,
        filePath: photo.filePath,
        caption: photo.caption,
      });
      photoMessageId = pmsg?.message_id != null ? BigInt(pmsg.message_id) : null;
    } catch (err) {
      status = telegramMessageId
        ? AuditChannelStatus.PARTIAL
        : AuditChannelStatus.FAILED;
      error = [error, `photo: ${err.message}`].filter(Boolean).join(" | ");
      logger.error("Audit channel sendPhoto failed", {
        context: "AuditChannel",
        eventType,
        orderId,
        logId: logRow.id,
        error: err.message,
        stack: err.stack,
      });
    }
  }

  try {
    await markLog(logRow.id, {
      status,
      telegramMessageId,
      photoMessageId,
      error,
      sentAt: status === AuditChannelStatus.FAILED ? null : new Date(),
      retryCount: { increment: 0 },
    });
  } catch (err) {
    logger.error("Audit channel DB update failed", {
      context: "AuditChannel",
      logId: logRow.id,
      error: err.message,
    });
  }

  logger.info("AUDIT_CHANNEL_POST", {
    context: "AuditChannel",
    event: "AUDIT_CHANNEL_POST",
    eventType,
    orderId,
    logId: logRow.id,
    status,
    telegramMessageId: telegramMessageId != null ? String(telegramMessageId) : null,
  });

  return { logId: logRow.id, status, telegramMessageId, photoMessageId };
}

async function postDeliveryCompleted(orderId, meta = {}) {
  try {
    const order = await loadOrder(orderId);
    if (!order) return null;
    const adminName = await resolveConfirmingAdminName(order);
    order._confirmingAdminName = adminName || "—";

    const text = formatDeliveryCompleted(order, meta);
    const photoRow = (order.photos || []).find((p) => p.photoType === "HANDOVER");
    const photo =
      photoRow || meta.photoFileId
        ? {
            telegramFileId: photoRow?.telegramFileId || meta.photoFileId,
            filePath: photoRow?.filePath || null,
            caption: photoCaption(AuditChannelEvent.DELIVERY_COMPLETED, order.id),
          }
        : null;

    return publish({
      eventType: AuditChannelEvent.DELIVERY_COMPLETED,
      orderId: order.id,
      courierId: order.courierId,
      customerId: order.userId,
      text,
      photo,
      payload: { unitCode: meta.unitCode || order.inventoryUnit?.unitCode },
    });
  } catch (err) {
    logger.error("postDeliveryCompleted failed", {
      context: "AuditChannel",
      orderId,
      error: err.message,
      stack: err.stack,
    });
    return null;
  }
}

async function postReturnPickedUp(orderId, meta = {}) {
  try {
    const order = await loadOrder(orderId);
    if (!order) return null;
    const text = formatReturnPickedUp(order);
    const photoRow = (order.photos || []).find((p) => p.photoType === "RETURN");
    const photo =
      photoRow || meta.photoFileId
        ? {
            telegramFileId: photoRow?.telegramFileId || meta.photoFileId,
            filePath: photoRow?.filePath || null,
            caption: photoCaption(AuditChannelEvent.RETURN_PICKED_UP, order.id),
          }
        : null;

    return publish({
      eventType: AuditChannelEvent.RETURN_PICKED_UP,
      orderId: order.id,
      courierId: order.courierId,
      customerId: order.userId,
      text,
      photo,
    });
  } catch (err) {
    logger.error("postReturnPickedUp failed", {
      context: "AuditChannel",
      orderId,
      error: err.message,
      stack: err.stack,
    });
    return null;
  }
}

async function postInspectionCompleted(orderId, meta = {}) {
  try {
    const order = await loadOrder(orderId);
    if (!order) return null;

    // Default per-item lines from inventory when wizard has no granular results
    if (!meta.itemResults) {
      const inv = buildInventorySummary(order);
      const damaged = meta.outcome === "damaged" || meta.outcome === "maintenance";
      meta.itemResults = [
        { label: "Console", ok: !damaged, reason: damaged ? meta.note : null },
        ...inv.joysticks.map((j, i) => ({
          label: `Joystick${i + 1} (${j.code})`,
          ok: !(damaged && i === 0),
          reason: damaged && i === 0 ? meta.note || "Nosoz" : null,
        })),
        { label: "HDMI", ok: true },
        { label: "Power", ok: true },
      ];
    }

    const text = formatInspectionCompleted(order, meta);
    return publish({
      eventType: AuditChannelEvent.INSPECTION_COMPLETED,
      orderId: order.id,
      courierId: order.courierId,
      adminId: meta.adminId || meta.adminContext?.adminId || null,
      customerId: order.userId,
      text,
      photo: null,
      payload: {
        outcome: meta.outcome,
        fineAmount: meta.fineAmount || 0,
        note: meta.note || null,
      },
    });
  } catch (err) {
    logger.error("postInspectionCompleted failed", {
      context: "AuditChannel",
      orderId,
      error: err.message,
      stack: err.stack,
    });
    return null;
  }
}

/**
 * Retry FAILED / PARTIAL posts (photo-only or full).
 */
async function retryFailedLogs({ take = 20 } = {}) {
  const rows = await prisma.channelAuditLog.findMany({
    where: { status: { in: [AuditChannelStatus.FAILED, AuditChannelStatus.PARTIAL] } },
    orderBy: { createdAt: "asc" },
    take,
  });

  let ok = 0;
  for (const row of rows) {
    try {
      if (row.eventType === AuditChannelEvent.DELIVERY_COMPLETED) {
        await postDeliveryCompleted(row.orderId);
      } else if (row.eventType === AuditChannelEvent.RETURN_PICKED_UP) {
        await postReturnPickedUp(row.orderId);
      } else if (row.eventType === AuditChannelEvent.INSPECTION_COMPLETED) {
        await postInspectionCompleted(row.orderId, row.payload || {});
      }
      await markLog(row.id, { retryCount: { increment: 1 } });
      ok += 1;
    } catch (err) {
      await markLog(row.id, {
        retryCount: { increment: 1 },
        error: err.message,
      }).catch(() => {});
    }
  }
  return { attempted: rows.length, ok };
}

module.exports = {
  publish,
  postDeliveryCompleted,
  postReturnPickedUp,
  postInspectionCompleted,
  retryFailedLogs,
  loadOrder,
  AuditChannelEvent,
};
