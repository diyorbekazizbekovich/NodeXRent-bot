require("dotenv").config();

function parseIds(str) {
  return (str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s));
}

const env = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  BOT_MODE: process.env.BOT_MODE || "polling",
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
  ADMIN_TELEGRAM_IDS: parseIds(process.env.ADMIN_TELEGRAM_IDS),
  /** Factory Reset va eng xavfli amallar — bo'sh bo'lsa faqat birinchi ADMIN_TELEGRAM_IDS */
  SUPER_ADMIN_TELEGRAM_IDS: parseIds(process.env.SUPER_ADMIN_TELEGRAM_IDS),
  RETURN_REMINDER_HOURS_BEFORE: Number(process.env.RETURN_REMINDER_HOURS_BEFORE) || 2,
  COURIER_RESPONSE_TIMEOUT_MINUTES: Number(process.env.COURIER_RESPONSE_TIMEOUT_MINUTES) || 10,
  /** Buyurtma boshlanishidan oldin tasdiqlash oynasi (soat) */
  ORDER_CONFIRM_WINDOW_HOURS: Number(process.env.ORDER_CONFIRM_WINDOW_HOURS) || 6,
  /** Tasdiqlanmagan buyurtma uchun yuqori ustuvor eslatma (soat) */
  ORDER_PRIORITY_REMINDER_HOURS: Number(process.env.ORDER_PRIORITY_REMINDER_HOURS) || 2,
  DEFAULT_COMMISSION_PERCENT: Number(process.env.DEFAULT_COMMISSION_PERCENT) || 0,
  /** Mijoz yetkazib berish lokatsiyasini qayta yuborish oralig'i (ms) */
  LOCATION_UPDATE_COOLDOWN_MS: Number(process.env.LOCATION_UPDATE_COOLDOWN_MS) || 30_000,
  RUN_SEED: String(process.env.RUN_SEED || "false").toLowerCase() === "true",
};

if (!env.BOT_TOKEN) {
  console.warn("[env] OGOHLANTIRISH: BOT_TOKEN .env faylida topilmadi!");
}
if (!env.DATABASE_URL) {
  console.warn("[env] OGOHLANTIRISH: DATABASE_URL .env faylida topilmadi!");
}
if (env.NODE_ENV === "production") {
  if (!env.BOT_TOKEN || !env.DATABASE_URL) {
    console.error("[env] FATAL: BOT_TOKEN and DATABASE_URL are required in production");
    process.exit(1);
  }
  if (!env.ADMIN_TELEGRAM_IDS.length) {
    console.warn("[env] OGOHLANTIRISH: ADMIN_TELEGRAM_IDS bo'sh — admin panel ishlamasligi mumkin");
  }
}

module.exports = env;
