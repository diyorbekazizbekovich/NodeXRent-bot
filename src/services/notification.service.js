const prisma = require("../config/prisma");
const logger = require("../utils/logger");

let botInstance = null;

function initNotificationService(bot) {
  botInstance = bot;
}

async function sendToTelegram(telegramId, text, options = {}) {
  if (!botInstance) {
    logger.warn("Notification service: bot instance hali init qilinmagan");
    return false;
  }
  try {
    await botInstance.sendMessage(String(telegramId), text, {
      parse_mode: "HTML",
      ...options,
    });
    return true;
  } catch (err) {
    const msg = err.message || String(err);
    const unreachable =
      /chat not found|bot was blocked|user is deactivated|PEER_ID_INVALID|forbidden: bot/i.test(msg);
    logger[unreachable ? "warn" : "error"]("Xabar yuborishda xatolik", {
      context: "NotificationService",
      error: msg,
      telegramId: String(telegramId),
      unreachable: unreachable || undefined,
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
  "ADVERTISEMENT",
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
 */
async function notify({ orderId = null, type, recipientType, recipientTelegramId, recipientId = 0, text, options }) {
  const sent = await sendToTelegram(recipientTelegramId, text, options);
  await persistNotification({ orderId, type, recipientType, recipientId, isSent: sent });
  return sent;
}

module.exports = { initNotificationService, sendToTelegram, sendTelegramLocation, notify };
