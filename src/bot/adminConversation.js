/**
 * Shared admin conversation helpers — cancel / menu / wizard exit.
 * Single source of truth so inventory (and other) wizards never deadlock.
 */

const sessionStore = require("./sessionStore");

/** Reply-keyboard main menu labels — always reset any wizard */
const ADMIN_MENU_TEXTS = Object.freeze(
  new Set([
    "📊 Dashboard",
    "📅 Bugun",
    "👥 CRM",
    "📦 Buyurtmalar",
    "🎮 Inventar",
    "🎮 PlayStationlar",
    "📈 Analytics",
    "🚚 Kuryerlar",
    "💰 Narxlar",
    "💾 Backup",
    "📋 Loglar",
    "🏷️ Promo",
    "🏷️ Promo-kodlar",
    "📢 Reklama",
    "⚙️ Sozlamalar",
    "📊 Statistika",
    "👥 Foydalanuvchilar",
    "🗑 Bazani tozalash",
  ])
);

const CANCEL_TEXTS = Object.freeze(
  new Set([
    "/cancel",
    "/bekor",
    "❌ Bekor qilish",
    "❌ Bekor",
    "Bekor qilish",
    "🏠 Bosh menu",
    "🏠 Bosh menyu",
  ])
);

function cancelKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "❌ Bekor qilish", callback_data: "admin:conv:cancel" }]],
    },
  };
}

function isMenuText(text) {
  if (!text) return false;
  return ADMIN_MENU_TEXTS.has(String(text).trim());
}

function isCancelText(text) {
  if (!text) return false;
  const t = String(text).trim();
  if (CANCEL_TEXTS.has(t)) return true;
  if (/^\/cancel\b/i.test(t)) return true;
  return false;
}

/** True if this message should abort any active wizard and fall through to menu. */
function shouldAbortWizard(text) {
  return isMenuText(text) || isCancelText(text);
}

/**
 * If admin pressed menu/cancel while in a wizard — clear session.
 * Returns true when abort handled (caller should not continue wizard).
 */
function abortWizardIfRequested(chatId, text) {
  if (!shouldAbortWizard(text)) return false;
  if (!sessionStore.hasActiveStep(chatId)) return false;
  sessionStore.clearSession(chatId);
  return true;
}

/** Hard reset — call after success, fatal error, or explicit cancel. */
function resetConversation(chatId) {
  sessionStore.clearSession(chatId);
}

module.exports = {
  ADMIN_MENU_TEXTS,
  CANCEL_TEXTS,
  cancelKeyboard,
  isMenuText,
  isCancelText,
  shouldAbortWizard,
  abortWizardIfRequested,
  resetConversation,
};
