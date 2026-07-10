const factoryResetService = require("../../services/factoryReset.service");
const sessionStore = require("../sessionStore");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const prisma = require("../../config/prisma");
const logger = require("../../utils/logger");
const { addCallbackHandler } = require("../events/callbackRouter");

const STEP_PHRASE = "admin:factory:phrase";
const WARNING_TEXT =
  "⚠️ <b>DIQQAT!</b>\n\n" +
  "Siz butun tizim ma'lumotlarini o'chirishni boshlamoqdasiz.\n\n" +
  "Quyidagilar o'chiriladi:\n\n" +
  "• Foydalanuvchilar\n" +
  "• Buyurtmalar\n" +
  "• Faol ijaralar\n" +
  "• Tugallangan ijaralar\n" +
  "• Promo kodlar\n" +
  "• CRM yozishmalari\n" +
  "• Analytics ma'lumotlari\n" +
  "• Inventar tarixi\n" +
  "• To'lovlar\n" +
  "• Shartnomalar\n" +
  "• Rasmlar\n" +
  "• Loglar\n\n" +
  "Bu amalni ortga qaytarib bo'lmaydi.\n\n" +
  "Davom etilsinmi?";

function step1Keyboard(token) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "❌ Bekor qilish", callback_data: `admin:factory:cancel:${token}` },
          { text: "⚠️ Davom etish", callback_data: `admin:factory:step2:${token}` },
        ],
      ],
    },
  };
}

function step3Keyboard(token) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "❌ Yo'q", callback_data: `admin:factory:cancel:${token}` },
          { text: "✅ Ha, hammasini o'chir", callback_data: `admin:factory:execute:${token}` },
        ],
      ],
    },
  };
}

function assertToken(session, token) {
  return Boolean(token) && session?.data?._factoryToken === token && session?.data?._factoryAllowed === true;
}

async function startFactoryResetFlow(bot, chatId, telegramId) {
  if (!factoryResetService.isSuperAdmin(telegramId)) {
    await bot.sendMessage(chatId, "❗️ Bu amal faqat Super Admin uchun.");
    return;
  }

  const token = factoryResetService.createResetToken();
  sessionStore.setStep(chatId, "admin:factory:confirm1");
  sessionStore.updateData(chatId, {
    _factoryToken: token,
    _factoryAllowed: true,
    _factoryPhraseOk: false,
  });

  await bot.sendMessage(chatId, WARNING_TEXT, {
    parse_mode: "HTML",
    ...step1Keyboard(token),
  });
}

function registerAdminFactoryResetHandlers(bot, isAdmin) {
  addCallbackHandler("admin-factory", async (bot, query) => {
    if (!query.data?.startsWith("admin:factory:")) return false;

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const parts = query.data.split(":");
    // admin:factory:{action}:{token}
    const action = parts[2];
    const token = parts[3];

    if (!(await isAdmin(telegramId)) || !factoryResetService.isSuperAdmin(telegramId)) {
      await safeAnswerCallbackQuery(bot, query.id, { text: "Ruxsat yo'q." });
      return true;
    }

    const session = sessionStore.getSession(chatId);

    try {
      if (action === "cancel") {
        if (token && session.data?._factoryToken && token !== session.data._factoryToken) {
          await safeAnswerCallbackQuery(bot, query.id, { text: "Eski so'rov." });
          return true;
        }
        sessionStore.clearSession(chatId);
        await bot.sendMessage(chatId, "❌ Factory Reset bekor qilindi.");
        await safeAnswerCallbackQuery(bot, query.id);
        return true;
      }

      if (!assertToken(session, token)) {
        await safeAnswerCallbackQuery(bot, query.id, { text: "Noto'g'ri yoki muddati o'tgan." });
        await bot.sendMessage(
          chatId,
          "❗️ Xavfsizlik: so'rov yaroqsiz. «🗑 Bazani tozalash» orqali qaytadan boshlang."
        );
        return true;
      }

      if (action === "step2") {
        sessionStore.setStep(chatId, STEP_PHRASE);
        sessionStore.updateData(chatId, { _factoryPhraseOk: false });
        await bot.sendMessage(
          chatId,
          "⚠️ <b>Oxirgi ogohlantirish!</b>\n\n" +
            "Davom etish uchun quyidagi matnni <b>aynan</b> kiriting:\n\n" +
            `<code>${factoryResetService.CONFIRM_PHRASE}</code>\n\n` +
            "Katta-kichik harflar ham tekshiriladi.",
          { parse_mode: "HTML" }
        );
        await safeAnswerCallbackQuery(bot, query.id);
        return true;
      }

      if (action === "execute") {
        if (!session.data?._factoryPhraseOk) {
          await safeAnswerCallbackQuery(bot, query.id, { text: "Avval tasdiq matnini kiriting." });
          return true;
        }

        // Duplicate: tokenni darhol yo'q qilamiz
        const usedToken = session.data._factoryToken;
        sessionStore.updateData(chatId, {
          _factoryToken: null,
          _factoryAllowed: false,
          _factoryPhraseOk: false,
          _factoryExecuting: true,
        });

        await safeAnswerCallbackQuery(bot, query.id, { text: "Boshlanmoqda..." });
        await bot.sendMessage(chatId, "⏳ Database tozalanmoqda... Kutib turing.");

        const adminRecord = await prisma.admin.findUnique({
          where: { telegramId: BigInt(telegramId) },
        });

        try {
          const result = await factoryResetService.executeFactoryReset({
            telegramId,
            adminId: adminRecord?.id,
          });
          sessionStore.clearSession(chatId);
          await bot.sendMessage(chatId, factoryResetService.formatSuccessMessage(result));
        } catch (err) {
          sessionStore.clearSession(chatId);
          logger.error("Factory reset failed", { error: err.message, stack: err.stack, usedToken });
          await bot.sendMessage(
            chatId,
            `❗️ Factory Reset muvaffaqiyatsiz.\n\n${err.message}\n\nHech narsa o'zgarmagan bo'lishi kerak (ROLLBACK).`
          );
        }
        return true;
      }

      await safeAnswerCallbackQuery(bot, query.id, { text: "Noma'lum amal." });
    } catch (err) {
      logger.error("Factory reset callback error", { error: err.message });
      await safeAnswerCallbackQuery(bot, query.id, { text: "Xato" });
    }
    return true;
  });
}

/**
 * 2-bosqich: aniq "DELETE ALL DATA" matni
 * @returns {Promise<boolean>}
 */
async function handleFactoryResetMessage(bot, chatId, msg, session) {
  if (session.step !== STEP_PHRASE) return false;

  const telegramId = msg.from.id;
  if (!factoryResetService.isSuperAdmin(telegramId)) {
    sessionStore.clearSession(chatId);
    await bot.sendMessage(chatId, "❗️ Ruxsat yo'q.");
    return true;
  }

  if (!session.data?._factoryToken || !session.data?._factoryAllowed) {
    sessionStore.clearSession(chatId);
    await bot.sendMessage(chatId, "❗️ Sessiya yaroqsiz. Qaytadan boshlang.");
    return true;
  }

  const text = (msg.text || "").trim();
  if (text !== factoryResetService.CONFIRM_PHRASE) {
    await bot.sendMessage(
      chatId,
      `❗️ Matn mos kelmadi.\n\nAynan shuni yozing:\n<code>${factoryResetService.CONFIRM_PHRASE}</code>\n\nYoki menyudan boshqa tugmani bosing (bekor).`,
      { parse_mode: "HTML" }
    );
    return true;
  }

  sessionStore.setStep(chatId, "admin:factory:confirm3");
  sessionStore.updateData(chatId, { _factoryPhraseOk: true });

  await bot.sendMessage(
    chatId,
    "Haqiqatan ham <b>barcha</b> ma'lumotlarni o'chirmoqchimisiz?",
    {
      parse_mode: "HTML",
      ...step3Keyboard(session.data._factoryToken),
    }
  );
  return true;
}

module.exports = {
  registerAdminFactoryResetHandlers,
  handleFactoryResetMessage,
  startFactoryResetFlow,
  STEP_PHRASE,
};
