const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const {
  messagePreview,
  utf8ByteLength,
  parseEntityByteOffset,
  snippetAroundByteOffset,
} = require("../utils/telegramFormat");

let botInstance = null;

function initNotificationService(bot) {
  botInstance = bot;
}

function buildOutboundLog(telegramId, text, options, error) {
  const parseMode = options?.parse_mode || "HTML";
  const body = text != null ? String(text) : "";
  const log = {
    context: "NotificationService",
    function: "sendToTelegram",
    chatId: String(telegramId),
    parse_mode: parseMode,
    textLength: body.length,
    utf8Bytes: utf8ByteLength(body),
    preview: messagePreview(body, 300),
  };
  if (error) {
    const offset = parseEntityByteOffset(error.message || error);
    log.error = error.message || String(error);
    if (offset != null) {
      log.entityByteOffset = offset;
      log.entitySnippet = snippetAroundByteOffset(body, offset);
    }
  }
  return log;
}

async function sendToTelegram(telegramId, text, options = {}) {
  if (!botInstance) {
    logger.warn("Notification service: bot instance hali init qilinmagan");
    return false;
  }

  const merged = {
    parse_mode: "HTML",
    ...options,
  };

  try {
    await botInstance.sendMessage(String(telegramId), text, merged);
    return true;
  } catch (err) {
    const msg = err.message || String(err);
    const unreachable =
      /chat not found|bot was blocked|user is deactivated|PEER_ID_INVALID|forbidden: bot/i.test(msg);
    const isParse = /can't parse entities|parse entities|unsupported start tag/i.test(msg);
    logger[unreachable ? "warn" : "error"]("Xabar yuborishda xatolik", {
      ...buildOutboundLog(telegramId, text, merged, err),
      unreachable: unreachable || undefined,
      parseError: isParse || undefined,
    });
    return false;
  }
}

/**
 * Native Telegram location pin (courier map updates without refresh).
 */
async function sendTelegramLocation(telegramId, latitude, longitude) {
  if (!botInstance) {
    logger.warn("Notification service: bot instance hali init qilinmagan");
    return false;
  }
  if (latitude == null || longitude == null) return false;
  try {
    await botInstance.sendLocation(String(telegramId), Number(latitude), Number(longitude));
    return true;
  } catch (err) {
    const msg = err.message || String(err);
    const unreachable =
      /chat not found|bot was blocked|user is deactivated|PEER_ID_INVALID|forbidden: bot/i.test(msg);
    logger[unreachable ? "warn" : "error"]("Lokatsiya yuborishda xatolik", {
      context: "NotificationService",
      error: msg,
      telegramId: String(telegramId),
      unreachable: unreachable || undefined,
    });
    return false;
  }
}

const KNOWN_NOTIFICATION_TYPES = new Set([
  "ORDER_CREATED",
  "ORDER_ACCEPTED",
  "ORDER_REJECTED",
  "COURIER_ON_WAY",
  "ORDER_DELIVERED",
  "RETURN_REMINDER",
  "ORDER_RETURNED",
  "ORDER_COMPLETED",
  "ORDER_CANCELLED",
  "COURIER_ASSIGNED",
  "ORDER_ARRIVED",
  "ADMIN_ORDER_ASSIGNED",
  "LOCATION_UPDATED",
  "PROMO",
  "ORDER_CONFIRM_READY",
  "ORDER_PRIORITY_REMINDER",
  "ORDER_START_REMINDER",
]);

async function persistNotification({ orderId, type, recipientType, recipientId, isSent }) {
  const safeType = KNOWN_NOTIFICATION_TYPES.has(type) ? type : "ORDER_CREATED";
  try {
    await prisma.notification.create({
      data: {
        orderId,
        type: safeType,
        recipientType,
        recipientId: Number(recipientId) || 0,
        isSent,
        sentAt: isSent ? new Date() : null,
      },
    });
  } catch (err) {
    logger.warn("Notification audit yozilmadi", {
      context: "NotificationService",
      error: err.message,
      type: safeType,
      recipientType,
      recipientId,
    });
  }
}

/**
 * Telegram xabar yuboradi. Audit log xatosi asosiy jarayonni to'xtatmaydi.
 *
 * Contract:
 *  - text (preferred) or message (legacy alias)
 *  - recipientTelegramId (required for delivery)
 *  - recipientId = DB admin/user/courier id for audit (NOT telegram id)
 */
async function notify({
  orderId = null,
  type,
  recipientType,
  recipientTelegramId,
  recipientId = 0,
  text,
  message,
  options,
} = {}) {
  const body = text != null ? text : message;
  let tgId = recipientTelegramId;

  // Legacy misuse: callers passed Telegram ID as recipientId and used `message`
  if (
    (tgId == null || tgId === "") &&
    recipientId != null &&
    Number(recipientId) > 1_000_000
  ) {
    logger.warn("notify legacy: recipientTelegramId missing — using recipientId as chat id", {
      context: "NotificationService",
      type,
      recipientType,
      recipientId,
      orderId,
    });
    tgId = recipientId;
  }

  if (tgId == null || tgId === "") {
    logger.error("notify aborted: missing recipientTelegramId", {
      context: "NotificationService",
      type,
      recipientType,
      orderId,
      stack: new Error("missing recipientTelegramId").stack,
    });
    await persistNotification({
      orderId,
      type,
      recipientType,
      recipientId,
      isSent: false,
    });
    return false;
  }

  if (body == null || String(body).trim() === "") {
    logger.error("notify aborted: empty text", {
      context: "NotificationService",
      type,
      recipientType,
      orderId,
      recipientTelegramId: String(tgId),
      stack: new Error("empty notify text").stack,
    });
    await persistNotification({
      orderId,
      type,
      recipientType,
      recipientId,
      isSent: false,
    });
    return false;
  }

  const sent = await sendToTelegram(tgId, body, options);
  await persistNotification({ orderId, type, recipientType, recipientId, isSent: sent });
  return sent;
}

module.exports = { initNotificationService, sendToTelegram, sendTelegramLocation, notify };
