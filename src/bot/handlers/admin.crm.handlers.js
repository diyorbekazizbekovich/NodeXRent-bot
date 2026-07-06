const customerCrmService = require("../../services/customerCrm.service");
const sessionStore = require("../sessionStore");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { CustomerRating } = require("../../constants/customerRating");
const prisma = require("../../config/prisma");

function crmListKeyboard(users) {
  const rows = users.map((u) => [
    {
      text: `${u.fullName || u.phone || u.telegramId}`,
      callback_data: `admin:crm:view:${u.id}`,
    },
  ]);
  rows.push([{ text: "🔍 Qidiruv", callback_data: "admin:crm:search" }]);
  return { reply_markup: { inline_keyboard: rows } };
}

function crmProfileKeyboard(userId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📜 Tarix", callback_data: `admin:crm:history:${userId}` },
          { text: "📝 Izoh", callback_data: `admin:crm:notes:${userId}` },
        ],
        [
          { text: "⭐ Ishonchli", callback_data: `admin:crm:rate:${userId}:TRUSTED` },
          { text: "👤 Oddiy", callback_data: `admin:crm:rate:${userId}:NORMAL` },
        ],
        [{ text: "⚠️ Xavfli", callback_data: `admin:crm:rate:${userId}:RISKY` }],
      ],
    },
  };
}

function registerAdminCrmHandlers(bot, isAdmin) {
  bot.on("callback_query", async (query) => {
    if (!query.data.startsWith("admin:crm:")) return;
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    if (!(await isAdmin(telegramId))) {
      await safeAnswerCallbackQuery(bot, query.id, { text: "Ruxsat yo'q." });
      return;
    }

    const parts = query.data.split(":");
    const action = parts[2];
    const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
    const ctx = { telegramId, adminId: adminRecord?.id };

    try {
      if (action === "search") {
        sessionStore.setStep(chatId, "admin:crm:search");
        await bot.sendMessage(chatId, "Mijoz ismi, telefon yoki username kiriting:");
      } else if (action === "view") {
        const userId = Number(parts[3]);
        const profile = await customerCrmService.getCustomerProfile(userId);
        if (!profile) {
          await bot.sendMessage(chatId, "Mijoz topilmadi.");
        } else {
          await bot.sendMessage(chatId, customerCrmService.formatProfile(profile), {
            parse_mode: "Markdown",
            ...crmProfileKeyboard(userId),
          });
        }
      } else if (action === "history") {
        const userId = Number(parts[3]);
        const profile = await customerCrmService.getCustomerProfile(userId);
        await bot.sendMessage(chatId, customerCrmService.formatOrderHistory(profile.user), {
          parse_mode: "Markdown",
        });
      } else if (action === "notes") {
        const userId = Number(parts[3]);
        sessionStore.setStep(chatId, "admin:crm:notes");
        sessionStore.updateData(chatId, { _crmUserId: userId });
        await bot.sendMessage(chatId, "Admin izohini kiriting:");
      } else if (action === "rate") {
        const userId = Number(parts[3]);
        const rating = parts[4];
        if (!Object.values(CustomerRating).includes(rating)) throw new Error("Noto'g'ri reyting");
        await customerCrmService.setRating(userId, rating, ctx);
        await bot.sendMessage(chatId, `✅ Reyting yangilandi: ${rating}`);
      }
      await safeAnswerCallbackQuery(bot, query.id);
    } catch (err) {
      await safeAnswerCallbackQuery(bot, query.id, { text: err.message });
    }
  });
}

async function handleCrmAdminMessage(bot, chatId, msg, session) {
  if (session.step === "admin:crm:search") {
    const users = await customerCrmService.listCustomers({ query: msg.text.trim() });
    sessionStore.clearSession(chatId);
    if (!users.length) {
      await bot.sendMessage(chatId, "Mijoz topilmadi.");
      return true;
    }
    await bot.sendMessage(chatId, "👥 *CRM — natijalar*", {
      parse_mode: "Markdown",
      ...crmListKeyboard(users),
    });
    return true;
  }
  if (session.step === "admin:crm:notes") {
    const adminRecord = await require("../../config/prisma").admin.findUnique({
      where: { telegramId: BigInt(msg.from.id) },
    });
    await customerCrmService.setNotes(session.data._crmUserId, msg.text.trim(), {
      telegramId: msg.from.id,
      adminId: adminRecord?.id,
    });
    sessionStore.clearSession(chatId);
    await bot.sendMessage(chatId, "✅ Izoh saqlandi.");
    return true;
  }
  return false;
}

async function showCrmMenu(bot, chatId) {
  const users = await customerCrmService.listCustomers({});
  await bot.sendMessage(chatId, "👥 *Mijozlar CRM*", {
    parse_mode: "Markdown",
    ...crmListKeyboard(users),
  });
}

module.exports = { registerAdminCrmHandlers, handleCrmAdminMessage, showCrmMenu };
