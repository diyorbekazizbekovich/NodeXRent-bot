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
  RETURN_REMINDER_HOURS_BEFORE: Number(process.env.RETURN_REMINDER_HOURS_BEFORE) || 2,
  COURIER_RESPONSE_TIMEOUT_MINUTES: Number(process.env.COURIER_RESPONSE_TIMEOUT_MINUTES) || 10,
  DEFAULT_COMMISSION_PERCENT: Number(process.env.DEFAULT_COMMISSION_PERCENT) || 0,
};

if (!env.BOT_TOKEN) {
  console.warn("[env] OGOHLANTIRISH: BOT_TOKEN .env faylida topilmadi!");
}
if (!env.DATABASE_URL) {
  console.warn("[env] OGOHLANTIRISH: DATABASE_URL .env faylida topilmadi!");
}

module.exports = env;
