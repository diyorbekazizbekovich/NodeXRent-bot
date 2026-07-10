const logger = require("../../utils/logger");
const { registerListener } = require("./registry");

/**
 * Polling xatolarini loglaydi; node-telegram-bot-api odatda o'zi qayta urinadi.
 * EFATAL/fetch failed — vaqtinchalik tarmoq; botni to'xtatmaymiz.
 * setMaxListeners ishlatilmaydi.
 */
function setupPollingResilience(bot) {
  let consecutiveErrors = 0;
  let decayTimer = null;

  function scheduleDecay() {
    if (decayTimer) clearTimeout(decayTimer);
    decayTimer = setTimeout(() => {
      if (consecutiveErrors > 0) {
        logger.info("Polling xato hisoblagichi tiklandi", {
          context: "BotPolling",
          afterErrors: consecutiveErrors,
        });
        consecutiveErrors = 0;
      }
      decayTimer = null;
    }, 60_000);
    if (typeof decayTimer.unref === "function") decayTimer.unref();
  }

  registerListener(
    bot,
    "polling_error",
    (err) => {
      consecutiveErrors += 1;
      scheduleDecay();
      const msg = err?.message || String(err);
      const isNetwork =
        /EFATAL|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(
          msg
        );

      if (isNetwork) {
        logger.warn("Polling tarmoq xatosi (kutish / avto-qayta urinish)", {
          context: "BotPolling",
          error: msg,
          consecutiveErrors,
        });
      } else {
        logger.error("Polling xatoligi", {
          context: "BotPolling",
          error: msg,
          consecutiveErrors,
        });
      }
    },
    "polling-error"
  );

  registerListener(
    bot,
    "webhook_error",
    (err) => {
      logger.error("Webhook xatoligi", {
        context: "BotPolling",
        error: err?.message || String(err),
      });
    },
    "webhook-error"
  );
}

module.exports = { setupPollingResilience };
