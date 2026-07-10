const logger = require("../../utils/logger");
const { registerListener } = require("./registry");

/** @type {{ name: string, handle: (bot, msg) => Promise<boolean>|boolean }[]} */
const messageHandlers = [];
let routerRegistered = false;

function addMessageHandler(name, handle) {
  if (messageHandlers.some((h) => h.name === name)) {
    logger.warn(`Message handler allaqachon qo'shilgan: ${name}`, { context: "MessageRouter" });
    return;
  }
  messageHandlers.push({ name, handle });
  logger.info(`Message handler queued: ${name}`, { context: "MessageRouter" });
}

async function dispatchMessage(bot, msg) {
  for (const { name, handle } of messageHandlers) {
    try {
      const handled = await handle(bot, msg);
      if (handled) return;
    } catch (err) {
      logger.error(`Message handler xatoligi: ${name}`, {
        context: "MessageRouter",
        error: err.message,
        stack: err.stack,
      });
      return;
    }
  }
}

function registerMessageRouter(bot) {
  if (routerRegistered) {
    logger.warn("Message router allaqachon register qilingan", { context: "MessageRouter" });
    return;
  }
  routerRegistered = true;
  registerListener(
    bot,
    "message",
    async (msg) => {
      await dispatchMessage(bot, msg);
    },
    "central-message-router"
  );
  logger.info(`Message router active (${messageHandlers.length} handlers)`, {
    context: "MessageRouter",
  });
}

module.exports = {
  addMessageHandler,
  registerMessageRouter,
  dispatchMessage,
};
