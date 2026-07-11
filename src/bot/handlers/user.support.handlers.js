const sessionStore = require("../sessionStore");
const supportChatService = require("../../services/supportChat.service");
const userService = require("../../services/user.service");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { t, resolveLang } = require("../../i18n");
const logger = require("../../utils/logger");
const { STEPS } = require("../../constants/supportChat");
const { markMessageHandled } = require("../helpers/handledMessage");
const { addCallbackHandler } = require("../events/callbackRouter");

/**
 * Mijoz: 💬 Javob berish callback
 */
function registerUserSupportHandlers(bot) {
  addCallbackHandler("user-support", async (bot, query) => {
    if (!query.data?.startsWith("user:support:")) return false;

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const parts = query.data.split(":");
    const action = parts[2];

    await safeAnswerCallbackQuery(bot, query.id);

    try {
      const user = await userService.getUserByTelegramId(telegramId);
      const L = resolveLang(user?.language);

      if (!user) {
        await bot.sendMessage(chatId, t("support.needRegister", L));
        return true;
      }

      if (action === "reply") {
        const threadId = Number(parts[3]);
        if (!Number.isFinite(threadId) || threadId <= 0) {
          await bot.sendMessage(chatId, t("support.invalid", L));
          return true;
        }

        try {
          await supportChatService.assertThreadOwnedByUser(threadId, user.id);
        } catch (_) {
          await bot.sendMessage(chatId, t("support.forbidden", L));
          return true;
        }

        sessionStore.setStep(chatId, STEPS.USER_REPLY);
        sessionStore.updateData(chatId, { _supportThreadId: threadId, _supportUserId: user.id });
        await bot.sendMessage(chatId, t("support.askReply", L));
        return true;
      }
    } catch (err) {
      logger.error("User support callback error", { error: err.message });
      await bot.sendMessage(chatId, "Xato");
    }
    return true;
  });
}

/**
 * Mijoz javob xabari (matn + media)
 * @returns {Promise<boolean>}
 */
async function handleUserSupportMessage(bot, msg) {
  const chatId = msg.chat.id;
  const session = sessionStore.getSession(chatId);
  if (session.step !== STEPS.USER_REPLY) return false;

  const user = await userService.getUserByTelegramId(msg.from.id);
  const L = resolveLang(user?.language);

  if (!user) {
    sessionStore.clearSession(chatId);
    await bot.sendMessage(chatId, t("support.needRegister", L));
    return true;
  }

  // Sessiondagi userId DB bilan mos kelishi shart (boshqa mijoz nomidan yozish mumkin emas)
  if (session.data?._supportUserId && session.data._supportUserId !== user.id) {
    sessionStore.clearSession(chatId);
    await bot.sendMessage(chatId, t("support.forbidden", L));
    return true;
  }

  const threadId = Number(session.data?._supportThreadId);
  if (Number.isFinite(threadId) && threadId > 0) {
    try {
      await supportChatService.assertThreadOwnedByUser(threadId, user.id);
    } catch (_) {
      sessionStore.clearSession(chatId);
      await bot.sendMessage(chatId, t("support.forbidden", L));
      return true;
    }
  }

  if (!supportChatService.hasRelayContent(msg)) {
    await bot.sendMessage(chatId, t("support.sendContent", L));
    return true;
  }

  markMessageHandled(msg);

  try {
    await supportChatService.sendUserToAdmins({ bot, user, msg });
    sessionStore.clearSession(chatId);
    await bot.sendMessage(chatId, t("support.sent", L));
  } catch (err) {
    if (err instanceof supportChatService.SupportChatError && err.code === "BUSY") {
      await bot.sendMessage(chatId, err.message);
      return true;
    }
    logger.error("User→admin support send failed", { error: err.message, userId: user.id });
    await bot.sendMessage(chatId, t("support.sendFail", L, { error: err.message }));
  }
  return true;
}

module.exports = {
  registerUserSupportHandlers,
  handleUserSupportMessage,
};
