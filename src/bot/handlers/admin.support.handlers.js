const sessionStore = require("../sessionStore");
const supportChatService = require("../../services/supportChat.service");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { cancelComposeKeyboard } = require("../keyboards/support.keyboards");
const { STEPS } = require("../../constants/supportChat");
const logger = require("../../utils/logger");
const { markMessageHandled } = require("../helpers/handledMessage");
const { addCallbackHandler } = require("../events/callbackRouter");

/**
 * Admin callback: reply / cancel
 */
function registerAdminSupportHandlers(bot, isAdmin) {
  addCallbackHandler("admin-support", async (bot, query) => {
    if (!query.data?.startsWith("admin:support:")) return false;
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;

    if (!(await isAdmin(telegramId))) {
      await safeAnswerCallbackQuery(bot, query.id, { text: "Ruxsat yo'q." });
      return true;
    }

    const parts = query.data.split(":");
    const action = parts[2];

    try {
      if (action === "cancel") {
        sessionStore.clearSession(chatId);
        await bot.sendMessage(chatId, "❌ Xabar yozish bekor qilindi.");
        await safeAnswerCallbackQuery(bot, query.id);
        return true;
      }

      if (action === "reply") {
        const userId = Number(parts[3]);
        if (!Number.isFinite(userId) || userId <= 0) {
          await safeAnswerCallbackQuery(bot, query.id, { text: "Noto'g'ri mijoz." });
          return true;
        }
        sessionStore.setStep(chatId, STEPS.ADMIN_COMPOSE);
        sessionStore.updateData(chatId, { _supportUserId: userId });
        await bot.sendMessage(
          chatId,
          "Mijozga yubormoqchi bo'lgan xabaringizni yuboring.\n\n" +
            "Matn, rasm, video, ovoz, fayl va boshqalar qabul qilinadi.",
          cancelComposeKeyboard()
        );
        await safeAnswerCallbackQuery(bot, query.id);
        return true;
      }

      await safeAnswerCallbackQuery(bot, query.id);
    } catch (err) {
      logger.error("Admin support callback error", { error: err.message });
      await safeAnswerCallbackQuery(bot, query.id, { text: err.message?.slice(0, 50) || "Xato" });
    }
    return true;
  });
}

/**
 * Admin compose session — matn + media
 * @returns {Promise<boolean>} handled
 */
async function handleAdminSupportMessage(bot, chatId, msg, session) {
  if (session.step !== STEPS.ADMIN_COMPOSE) return false;

  const userId = Number(session.data?._supportUserId);
  if (!Number.isFinite(userId) || userId <= 0) {
    sessionStore.clearSession(chatId);
    await bot.sendMessage(chatId, "❗️ Mijoz konteksti yo'qoldi. CRM orqali qayta tanlang.");
    return true;
  }

  if (!supportChatService.hasRelayContent(msg)) {
    await bot.sendMessage(chatId, "❗️ Matn yoki media yuboring.");
    return true;
  }

  markMessageHandled(msg);

  try {
    await supportChatService.sendAdminToUser({
      bot,
      adminTelegramId: msg.from.id,
      adminFullName: [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" "),
      userId,
      msg,
    });
    sessionStore.clearSession(chatId);
    await bot.sendMessage(chatId, "✅ Xabar mijozga yuborildi.");
  } catch (err) {
    if (err instanceof supportChatService.SupportChatError && err.code === "BUSY") {
      await bot.sendMessage(chatId, err.message);
      return true;
    }
    logger.error("Admin→user support send failed", { error: err.message, userId });
    await bot.sendMessage(chatId, `❗️ Yuborilmadi: ${err.message}`);
  }
  return true;
}

module.exports = {
  registerAdminSupportHandlers,
  handleAdminSupportMessage,
};
