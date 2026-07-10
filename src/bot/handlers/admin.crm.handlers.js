const customerCrmService = require("../../services/customerCrm.service");
const supportChatService = require("../../services/supportChat.service");
const sessionStore = require("../sessionStore");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { CustomerRating } = require("../../constants/customerRating");
const { STEPS } = require("../../constants/supportChat");
const {
  customerActionsKeyboard,
  crmProfileActionsKeyboard,
  cancelComposeKeyboard,
} = require("../keyboards/support.keyboards");
const prisma = require("../../config/prisma");
const { addCallbackHandler } = require("../events/callbackRouter");

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

function registerAdminCrmHandlers(bot, isAdmin) {
  addCallbackHandler("admin-crm", async (bot, query) => {
    if (!query.data?.startsWith("admin:crm:")) return false;
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    if (!(await isAdmin(telegramId))) {
      await safeAnswerCallbackQuery(bot, query.id, { text: "Ruxsat yo'q." });
      return true;
    }

    const parts = query.data.split(":");
    const action = parts[2];
    const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
    const ctx = { telegramId, adminId: adminRecord?.id };

    try {
      if (action === "search") {
        sessionStore.setStep(chatId, "admin:crm:search");
        await bot.sendMessage(chatId, "Mijoz ismi, telefon yoki username kiriting:");
      } else if (action === "back") {
        const users = await customerCrmService.listCustomers({});
        await bot.sendMessage(chatId, "👥 *Mijozlar CRM*", {
          parse_mode: "Markdown",
          ...crmListKeyboard(users),
        });
      } else if (action === "view") {
        const userId = Number(parts[3]);
        if (!Number.isFinite(userId) || userId <= 0) {
          await bot.sendMessage(chatId, "Noto'g'ri mijoz.");
        } else {
          const profile = await customerCrmService.getCustomerProfile(userId);
          if (!profile) {
            await bot.sendMessage(chatId, "Mijoz topilmadi.");
          } else {
            const name = profile.user.fullName || profile.user.phone || profile.user.telegramId;
            await bot.sendMessage(chatId, `👤 *${name}*\n\nQuyidagi amallardan birini tanlang:`, {
              parse_mode: "Markdown",
              ...customerActionsKeyboard(userId),
            });
          }
        }
      } else if (action === "profile") {
        const userId = Number(parts[3]);
        const profile = await customerCrmService.getCustomerProfile(userId);
        if (!profile) {
          await bot.sendMessage(chatId, "Mijoz topilmadi.");
        } else {
          await bot.sendMessage(chatId, customerCrmService.formatProfile(profile), {
            parse_mode: "Markdown",
            ...crmProfileActionsKeyboard(userId),
          });
        }
      } else if (action === "orders" || action === "history") {
        const userId = Number(parts[3]);
        const profile = await customerCrmService.getCustomerProfile(userId);
        if (!profile) {
          await bot.sendMessage(chatId, "Mijoz topilmadi.");
        } else {
          await bot.sendMessage(chatId, customerCrmService.formatOrderHistory(profile.user), {
            parse_mode: "Markdown",
            ...customerActionsKeyboard(userId),
          });
        }
      } else if (action === "chathistory") {
        const userId = Number(parts[3]);
        const { text } = await supportChatService.getChatHistory(userId, { take: 25 });
        await bot.sendMessage(chatId, text, {
          parse_mode: "Markdown",
          ...customerActionsKeyboard(userId),
        });
      } else if (action === "msg") {
        const userId = Number(parts[3]);
        if (!Number.isFinite(userId) || userId <= 0) {
          await bot.sendMessage(chatId, "Noto'g'ri mijoz.");
        } else {
          sessionStore.setStep(chatId, STEPS.ADMIN_COMPOSE);
          sessionStore.updateData(chatId, { _supportUserId: userId });
          await bot.sendMessage(
            chatId,
            "Mijozga yubormoqchi bo'lgan xabaringizni yuboring.\n\n" +
              "Matn, rasm, video, ovoz, fayl va boshqalar qabul qilinadi.",
            cancelComposeKeyboard()
          );
        }
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
    return true;
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
    const adminRecord = await prisma.admin.findUnique({
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
