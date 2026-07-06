const telegramBotApi = require("node-telegram-bot-api");
// v1.x named/default export; v0.x direct constructor export
const TelegramBot = telegramBotApi.default || telegramBotApi.TelegramBot || telegramBotApi;
const env = require("../config/env");
const logger = require("../utils/logger");
const { initNotificationService } = require("../services/notification.service");

const userHandlers = require("./handlers/user.handlers");
const courierHandlers = require("./handlers/courier.handlers");
const adminHandlers = require("./handlers/admin.handlers");

function createBot() {
  const isWebhook = env.BOT_MODE === "webhook";

  const bot = new TelegramBot(env.BOT_TOKEN, {
    polling: !isWebhook,
  });

  if (isWebhook && env.WEBHOOK_URL) {
    bot.setWebHook(`${env.WEBHOOK_URL}/webhook/${env.BOT_TOKEN}`, {
      secret_token: env.WEBHOOK_SECRET,
    });
  }

  // Notification service'ga bot instance'ni beramiz (xabar yuborish uchun)
  initNotificationService(bot);

  // Har bir rol uchun handler'larni ro'yxatdan o'tkazamiz.
  // MUHIM: courier va admin handlerlari o'zining shartlarini (isCourier/isAdmin) ichida
  // tekshiradi, shuning uchun bir nechta "on message" listener bo'lishi muammo emas —
  // har biri faqat o'ziga tegishli holatda amal bajaradi.
  userHandlers.register(bot);
  courierHandlers.register(bot);
  adminHandlers.register(bot);

  bot.on("polling_error", (err) => {
    logger.error("Polling xatoligi", { context: "Bot", error: err.message });
  });

  bot.on("webhook_error", (err) => {
    logger.error("Webhook xatoligi", { context: "Bot", error: err.message });
  });

  logger.info(`Bot ishga tushdi (${isWebhook ? "webhook" : "polling"} rejimida)`, { context: "Bot" });

  return bot;
}

module.exports = { createBot };
