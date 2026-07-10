const logger = require("../../utils/logger");

/** @type {Map<string, number>} */
const registrationCounts = new Map();

/**
 * Bot event listenerini bir marta (yoki nom bo'yicha kuzatib) ro'yxatdan o'tkazadi.
 * setMaxListeners ishlatilmaydi — duplicate oldini olish asosiy himoya.
 */
function registerListener(bot, event, handler, name = "anonymous") {
  const key = `${event}::${name}`;
  const prev = registrationCounts.get(key) || 0;
  if (prev > 0) {
    logger.warn(`Listener qayta register qilinmoqda (skip): ${event} (${name})`, {
      context: "BotEvents",
      count: prev + 1,
    });
    return false;
  }
  bot.on(event, handler);
  registrationCounts.set(key, 1);
  logger.info(`Registered ${event} listener`, { context: "BotEvents", name });
  return true;
}

function registerTextCommand(bot, regexp, handler, name) {
  const key = `text::${name || regexp.toString()}`;
  const prev = registrationCounts.get(key) || 0;
  if (prev > 0) {
    logger.warn(`Text command qayta register (skip): ${name}`, { context: "BotEvents" });
    return false;
  }
  bot.onText(regexp, handler);
  registrationCounts.set(key, 1);
  logger.info(`Registered text command listener`, { context: "BotEvents", name: name || regexp.toString() });
  return true;
}

function getRegistrationSnapshot() {
  return Object.fromEntries(registrationCounts);
}

module.exports = {
  registerListener,
  registerTextCommand,
  getRegistrationSnapshot,
};
