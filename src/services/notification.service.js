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
    logger.error("Xabar yuborishda xatolik", {
      context: "NotificationService",
      error: err.message,
      telegramId: String(telegramId),
    });
    return false;
  }
}

async function persistNotification({ orderId, type, recipientType, recipientId, isSent }) {
  try {
    await prisma.notification.create({
      data: {
        orderId,
        type,
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

module.exports = { initNotificationService, sendToTelegram, notify };
