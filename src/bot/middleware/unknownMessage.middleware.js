const sessionStore = require("../sessionStore");
const userKeyboards = require("../keyboards/user.keyboards");
const userService = require("../../services/user.service");
const { t, resolveLang, allKnownUserMenuTexts } = require("../../i18n");
const { wasMessageHandled } = require("../helpers/handledMessage");
const { registerListener } = require("../events/registry");

/** Reply-keyboard matnlari — unknown handler ularni ushlamasin */
const KNOWN_MENU_TEXTS = new Set([
  ...allKnownUserMenuTexts(),
  // Courier
  "📦 Buyurtmalar",
  "✅ Faol buyurtmalar",
  "📜 Tarix",
  "👤 Profil",
  "⚙️ Sozlamalar",
  // Admin
  "📊 Dashboard",
  "📅 Bugun",
  "👥 CRM",
  "🎮 Inventar",
  "📈 Analytics",
  "🚚 Kuryerlar",
  "💰 Narxlar",
  "💾 Backup",
  "📋 Loglar",
  "🏷️ Promo",
  "🏷️ Promo-kodlar",
  "📢 Reklama",
  "📊 Statistika",
  "🎮 PlayStationlar",
  "👥 Foydalanuvchilar",
  "🗑 Bazani tozalash",
]);

function hasActiveScene(chatId) {
  const session = sessionStore.getSession(chatId);
  return Boolean(session.step);
}

function isUnsupportedContent(msg) {
  return Boolean(
    msg.sticker ||
      msg.photo ||
      msg.video ||
      msg.video_note ||
      msg.voice ||
      msg.audio ||
      msg.document ||
      msg.animation ||
      msg.dice ||
      msg.poll ||
      msg.game ||
      msg.venue ||
      msg.invoice ||
      msg.successful_payment ||
      msg.passport_data
  );
}

function isUnknownText(msg) {
  if (!msg.text) return false;
  const text = msg.text.trim();
  if (!text) return true;
  if (text.startsWith("/")) return false;
  if (KNOWN_MENU_TEXTS.has(text)) return false;
  return true;
}

async function isInRegistrationFlow(telegramId) {
  try {
    const user = await userService.getUserByTelegramId(telegramId);
    if (!user) return true;
    if (!user.language) return true;
    if (!user.phone) return true;
    if (!user.defaultAddress && !(user.latitude && user.longitude)) return true;
    return false;
  } catch (_) {
    return false;
  }
}

function registerUnknownMessageHandler(bot) {
  registerListener(
    bot,
    "message",
    async (msg) => {
      try {
        if (!msg.from || msg.from.is_bot) return;
        if (msg.contact || msg.location) return;
        if (wasMessageHandled(msg)) return;

        const chatId = msg.chat.id;
        if (hasActiveScene(chatId)) return;
        if (await isInRegistrationFlow(msg.from.id)) return;

        const unsupported = isUnsupportedContent(msg);
        const unknownText = isUnknownText(msg);
        if (!unsupported && !unknownText) return;

        const user = await userService.getUserByTelegramId(msg.from.id).catch(() => null);
        const L = resolveLang(user?.language);

        await bot.sendMessage(chatId, t("unknown.text", L), {
          parse_mode: "HTML",
          ...userKeyboards.mainMenuKeyboard(L),
        });
      } catch (_) {
        // Catch-all hech qachon botni sindirmasin
      }
    },
    "unknown-message"
  );
}

module.exports = {
  registerUnknownMessageHandler,
  hasActiveScene,
  isUnsupportedContent,
  isUnknownText,
  isInRegistrationFlow,
  KNOWN_MENU_TEXTS,
};
