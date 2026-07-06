const logger = require("../../utils/logger");

async function safeAnswerCallbackQuery(bot, queryId, options) {
  try {
    await bot.answerCallbackQuery(queryId, options);
  } catch (err) {
    logger.warn("Callback query javob berishda xatolik", {
      context: "Bot",
      error: err.message,
    });
  }
}

module.exports = { safeAnswerCallbackQuery };
