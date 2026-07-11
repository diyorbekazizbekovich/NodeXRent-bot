const logger = require("../../utils/logger");

/** Query IDs already acknowledged — Telegram allows exactly one answer per query. */
const answeredQueryIds = new Set();
const MAX_TRACKED = 2000;

/**
 * Acknowledge a callback query exactly once.
 * Safe to call multiple times / after long work — duplicates are no-ops.
 * @returns {Promise<boolean>} true if Telegram was contacted for this query
 */
async function safeAnswerCallbackQuery(bot, queryId, options) {
  if (!queryId || !bot) return false;
  if (answeredQueryIds.has(queryId)) return false;

  answeredQueryIds.add(queryId);
  if (answeredQueryIds.size > MAX_TRACKED) {
    const oldest = answeredQueryIds.values().next().value;
    answeredQueryIds.delete(oldest);
  }

  try {
    await bot.answerCallbackQuery(queryId, options);
    return true;
  } catch (err) {
    logger.warn("Callback query javob berishda xatolik", {
      context: "Bot",
      error: err.message,
      queryId,
    });
    return false;
  }
}

function isCallbackAnswered(queryId) {
  return Boolean(queryId) && answeredQueryIds.has(queryId);
}

/** Test / recovery helper */
function clearAnsweredCallbacks() {
  answeredQueryIds.clear();
}

module.exports = {
  safeAnswerCallbackQuery,
  isCallbackAnswered,
  clearAnsweredCallbacks,
};
