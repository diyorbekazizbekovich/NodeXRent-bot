const auditLogService = require("../../services/auditLog.service");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { addCallbackHandler } = require("../events/callbackRouter");

function registerAdminAuditHandlers(bot, isAdmin) {
  addCallbackHandler("admin-audit", async (bot, query) => {
    const data = query.data;
    if (!data?.startsWith("admin:audit:")) return false;

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    await safeAnswerCallbackQuery(bot, query.id);

    if (!(await isAdmin(telegramId))) {
      await bot.sendMessage(chatId, "Ruxsat yo'q.");
      return true;
    }

    const parts = data.split(":");
    const action = parts[2];

    try {
      if (action === "view") {
        const id = Number(parts[3]);
        const payload = await auditLogService.buildTelegramDetail(id);
        if (!payload) {
          await bot.sendMessage(chatId, "Log topilmadi.");
        } else {
          await bot.sendMessage(chatId, payload.text, payload.options);
        }
      } else if (action === "list") {
        const payload = await auditLogService.buildTelegramList(15);
        await bot.sendMessage(chatId, payload.text, payload.options);
      }
    } catch (err) {
      await bot.sendMessage(chatId, `❌ ${err.message}`);
    }
    return true;
  });
}

module.exports = { registerAdminAuditHandlers };
