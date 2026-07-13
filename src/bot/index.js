const telegramBotApi = require("node-telegram-bot-api");
const TelegramBot = telegramBotApi.default || telegramBotApi.TelegramBot || telegramBotApi;
const env = require("../config/env");
const logger = require("../utils/logger");
const { initNotificationService } = require("../services/notification.service");
const { applyRateLimitMiddleware } = require("./middleware/rateLimit.middleware");
const { registerUnknownMessageHandler } = require("./middleware/unknownMessage.middleware");
const { registerCallbackRouter, listCallbackHandlers } = require("./events/callbackRouter");
const { setupPollingResilience } = require("./events/polling");
const { getRegistrationSnapshot } = require("./events/registry");

const userHandlers = require("./handlers/user.handlers");
const courierHandlers = require("./handlers/courier.handlers");
const adminHandlers = require("./handlers/admin.handlers");

/** @type {import("node-telegram-bot-api")|null} */
let botSingleton = null;

function createBot() {
  if (botSingleton) {
    logger.warn("createBot qayta chaqirildi — mavjud singleton qaytarildi", { context: "Bot" });
    return botSingleton;
  }

  const isWebhook = env.BOT_MODE === "webhook";

  const bot = new TelegramBot(env.BOT_TOKEN, {
    polling: isWebhook
      ? false
      : {
          interval: 300,
          autoStart: true,
          params: { timeout: 10 },
        },
    request: {
      // Tarmoq uzilishida uzoq osilib qolmasin
      timeout: 30000,
      agentOptions: { keepAlive: true, keepAliveMsecs: 10000 },
    },
  });

  if (isWebhook && env.WEBHOOK_URL) {
    bot.setWebHook(`${env.WEBHOOK_URL}/webhook/${env.BOT_TOKEN}`, {
      secret_token: env.WEBHOOK_SECRET,
    });
  }

  applyRateLimitMiddleware(bot);
  initNotificationService(bot);
  require("../utils/telegramSend").installTelegramOutboundLogging(bot);

  // Handlerlar callbacklarni queue ga qo'shadi (bot.on emas)
  userHandlers.register(bot);
  courierHandlers.register(bot);
  adminHandlers.register(bot);

  // Bitta markaziy callback_query listener
  registerCallbackRouter(bot);

  // Idle foydalanuvchi — oxirida
  registerUnknownMessageHandler(bot);

  setupPollingResilience(bot);

  logger.info(`Bot ishga tushdi (${isWebhook ? "webhook" : "polling"} rejimida)`, {
    context: "Bot",
    callbackHandlers: listCallbackHandlers(),
    listeners: getRegistrationSnapshot(),
  });

  botSingleton = bot;
  return bot;
}

function getBot() {
  return botSingleton;
}

module.exports = { createBot, getBot };
