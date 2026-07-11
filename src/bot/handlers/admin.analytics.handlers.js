const analyticsService = require("../../services/analytics.service");
const { analyticsPeriodKeyboard } = require("../keyboards/admin.analytics.keyboards");
const adminKeyboards = require("../keyboards/admin.keyboards");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const logger = require("../../utils/logger");
const factoryResetService = require("../../services/factoryReset.service");
const { addCallbackHandler } = require("../events/callbackRouter");

const VALID_PERIODS = new Set(Object.values(analyticsService.PERIODS));

async function buildAnalyticsView(period = analyticsService.PERIODS.today) {
  const safe = VALID_PERIODS.has(period) ? period : analyticsService.PERIODS.today;
  const report = await analyticsService.getAnalyticsDashboard(safe);
  const text = analyticsService.formatAnalyticsHtml(report);
  return {
    period: safe,
    text,
    options: {
      parse_mode: "HTML",
      ...analyticsPeriodKeyboard(safe),
    },
  };
}

async function showAnalytics(bot, chatId, period = analyticsService.PERIODS.today) {
  try {
    const view = await buildAnalyticsView(period);
    return bot.sendMessage(chatId, view.text, view.options);
  } catch (err) {
    logger.error("Analytics show failed", { error: err.message, stack: err.stack });
    await bot.sendMessage(chatId, `❗️ Analytics yuklanmadi: ${err.message}`);
    throw err;
  }
}

async function editAnalytics(bot, chatId, messageId, period) {
  const view = await buildAnalyticsView(period);
  try {
    await bot.editMessageText(view.text, {
      chat_id: chatId,
      message_id: messageId,
      ...view.options,
    });
  } catch (err) {
    // Telegram "message is not modified" — ignore
    if (!/message is not modified/i.test(err.message || "")) {
      logger.warn("Analytics edit failed, fallback send", { error: err.message });
      await bot.sendMessage(chatId, view.text, view.options);
    }
  }
  return view.period;
}

function registerAdminAnalyticsHandlers(bot, isAdmin) {
  addCallbackHandler("admin-analytics", async (bot, query) => {
    if (!query.data?.startsWith("admin:analytics:")) return false;

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const messageId = query.message.message_id;

    await safeAnswerCallbackQuery(bot, query.id);

    if (!(await isAdmin(telegramId))) {
      await bot.sendMessage(chatId, "Ruxsat yo'q.");
      return true;
    }

    const parts = query.data.split(":");
    const action = parts[2];

    try {
      if (action === "back") {
        await bot.sendMessage(chatId, "🏠 Admin menyu:", adminKeyboards.mainMenuKeyboard({
          isSuperAdmin: factoryResetService.isSuperAdmin(telegramId),
        }));
        return true;
      }

      if (action === "period" || action === "refresh") {
        const period = parts[3];
        if (!VALID_PERIODS.has(period)) {
          await bot.sendMessage(chatId, "Noto'g'ri davr.");
          return true;
        }
        await editAnalytics(bot, chatId, messageId, period);
        return true;
      }

      await bot.sendMessage(chatId, "Noma'lum amal.");
    } catch (err) {
      logger.error("Analytics callback error", { error: err.message });
      try {
        await bot.sendMessage(chatId, `❗️ Analytics: ${err.message}`);
      } catch (_) {}
    }
    return true;
  });
}

module.exports = {
  registerAdminAnalyticsHandlers,
  showAnalytics,
  buildAnalyticsView,
};
