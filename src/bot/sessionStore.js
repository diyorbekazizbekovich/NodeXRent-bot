/**
 * node-telegram-bot-api o'zida Telegraf kabi "scene" mexanizmiga ega emas,
 * shuning uchun ko'p bosqichli suhbatlarni (masalan buyurtma jarayonini)
 * qo'lda boshqarish uchun oddiy in-memory sessiya ombori yaratamiz.
 *
 * Production muhitida bu yerni Redis bilan almashtirish tavsiya etiladi
 * (masalan, ko'p instance / PM2 cluster rejimida ishlashda holat yo'qolmasligi uchun).
 */

const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { step: null, data: {} });
  }
  return sessions.get(chatId);
}

function setStep(chatId, step) {
  const session = getSession(chatId);
  session.step = step;
  sessions.set(chatId, session);
}

function updateData(chatId, patch) {
  const session = getSession(chatId);
  session.data = { ...session.data, ...patch };
  sessions.set(chatId, session);
}

function clearSession(chatId) {
  sessions.set(chatId, { step: null, data: {} });
}

module.exports = { getSession, setStep, updateData, clearSession };
