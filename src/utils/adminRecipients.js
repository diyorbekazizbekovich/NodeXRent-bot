const env = require("../config/env");
const courierRepository = require("../repositories/courier.repository");

/**
 * Adminlarga xabar yuborish uchun ro'yxat.
 * recipientId — faqat DB dagi admin.id (INT32). Telegram ID emas!
 */
async function getAdminRecipients() {
  const dbAdmins = await courierRepository.listAllAdmins();
  const recipients = new Map();

  for (const admin of dbAdmins) {
    recipients.set(Number(admin.telegramId), { telegramId: Number(admin.telegramId), recipientId: admin.id });
  }

  for (const telegramId of env.ADMIN_TELEGRAM_IDS) {
    if (!recipients.has(telegramId)) {
      recipients.set(telegramId, { telegramId, recipientId: 0 });
    }
  }

  return Array.from(recipients.values());
}

module.exports = { getAdminRecipients };
