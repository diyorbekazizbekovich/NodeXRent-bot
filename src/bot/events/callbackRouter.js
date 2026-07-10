const logger = require("../../utils/logger");
const { registerListener } = require("./registry");

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

async function dispatchCallbackQuery(bot, query) {
  if (!query?.data) return;
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
