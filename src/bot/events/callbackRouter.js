const logger = require("../../utils/logger");
const { registerListener } = require("./registry");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");

/** @type {{ name: string, handle: (bot, query) => Promise<boolean>|boolean }[]} */
const callbackHandlers = [];
let routerRegistered = false;

/**
 * Callback handler qo'shadi. handle true qaytarsa routing to'xtaydi.
 */
function addCallbackHandler(name, handle) {
  if (callbackHandlers.some((h) => h.name === name)) {
    logger.warn(`Callback handler allaqachon qo'shilgan: ${name}`, { context: "CallbackRouter" });
    return;
  }
  callbackHandlers.push({ name, handle });
  logger.info(`Callback handler queued: ${name}`, { context: "CallbackRouter" });
}

/**
 * Dispatch callback. Acknowledges the query IMMEDIATELY (once), then runs handlers.
 * Handlers may still call safeAnswerCallbackQuery (idempotent no-op after early ack).
 * Long DB/API work must never delay the first answerCallbackQuery.
 */
async function dispatchCallbackQuery(bot, query) {
  if (!query?.id) return;

  // Telegram ~30s timeout — answer before any handler / DB / API work
  await safeAnswerCallbackQuery(bot, query.id);

  if (!query.data) return;

  for (const { name, handle } of callbackHandlers) {
    try {
      const handled = await handle(bot, query);
      if (handled) return;
    } catch (err) {
      logger.error(`Callback handler xatoligi: ${name}`, {
        context: "CallbackRouter",
        error: err.message,
        stack: err.stack,
        data: query.data,
      });
      return;
    }
  }
}

function registerCallbackRouter(bot) {
  if (routerRegistered) {
    logger.warn("Callback router allaqachon register qilingan", { context: "CallbackRouter" });
    return;
  }
  routerRegistered = true;
  registerListener(
    bot,
    "callback_query",
    async (query) => {
      await dispatchCallbackQuery(bot, query);
    },
    "central-callback-router"
  );
  logger.info(`Callback router active (${callbackHandlers.length} handlers)`, {
    context: "CallbackRouter",
  });
}

function listCallbackHandlers() {
  return callbackHandlers.map((h) => h.name);
}

module.exports = {
  addCallbackHandler,
  registerCallbackRouter,
  dispatchCallbackQuery,
  listCallbackHandlers,
};
