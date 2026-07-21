const prisma = require("../../config/prisma");
const earlyReturnService = require("../../services/earlyReturn.service");
const { EarlyReturnError } = require("../../services/earlyReturn.service");
const sessionStore = require("../sessionStore");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { addCallbackHandler } = require("../events/callbackRouter");
const { formatDatetime } = require("../../utils/dateHelper");
const logger = require("../../utils/logger");

const RESCHEDULE_STEP = "admin:er:reschedule";

function registerAdminEarlyReturnHandlers(bot, isAdmin) {
  addCallbackHandler("admin-early-return", async (bot, query) => {
    const data = query.data;
    if (!data?.startsWith("admin:er:")) return false;

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    await safeAnswerCallbackQuery(bot, query.id);

    if (!(await isAdmin(telegramId))) {
      await bot.sendMessage(chatId, "Ruxsat yo'q.");
      return true;
    }

    const parts = data.split(":");
    const action = parts[2];
    const requestId = Number(parts[3]);
    if (!Number.isFinite(requestId)) {
      await bot.sendMessage(chatId, "Noto'g'ri so'rov");
      return true;
    }

    const adminRecord = await prisma.admin.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    try {
      if (action === "approve") {
        const req = await earlyReturnService.approveRequest(requestId, {
          adminId: adminRecord?.id,
          adminTelegramId: telegramId,
        });
        await bot.sendMessage(
          chatId,
          `✅ Erta qaytarish #${requestId} tasdiqlandi.\n` +
            `📦 Buyurtma #${req.orderId} → RETURN_REQUESTED / kuryer vazifasi.`
        );
        try {
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: query.message.message_id }
          );
        } catch (_) {}
        return true;
      }

      if (action === "reject") {
        await earlyReturnService.rejectRequest(requestId, {
          adminId: adminRecord?.id,
          adminTelegramId: telegramId,
        });
        await bot.sendMessage(chatId, `❌ Erta qaytarish #${requestId} rad etildi.`);
        try {
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: query.message.message_id }
          );
        } catch (_) {}
        return true;
      }

      if (action === "contact") {
        const req = await earlyReturnService.getById(requestId);
        if (!req) {
          await bot.sendMessage(chatId, "So'rov topilmadi");
          return true;
        }
        const user = req.customer || req.order?.user;
        const phone = user?.phone || "—";
        const uname = user?.username ? `@${user.username}` : "—";
        const tgLink = user?.telegramId
          ? `tg://user?id=${user.telegramId}`
          : null;
        await bot.sendMessage(
          chatId,
          `💬 <b>Mijoz bilan bog'lanish</b>\n\n` +
            `👤 ${user?.fullName || "—"}\n` +
            `📱 ${phone}\n` +
            `Username: ${uname}\n` +
            `Telegram ID: <code>${user?.telegramId || "—"}</code>\n` +
            (tgLink ? `\n🔗 <a href="${tgLink}">Telegramda ochish</a>` : ""),
          { parse_mode: "HTML" }
        );
        return true;
      }

      if (action === "reschedule") {
        sessionStore.beginAction(chatId, RESCHEDULE_STEP, {
          _erRequestId: requestId,
        });
        await bot.sendMessage(
          chatId,
          `🕒 So'rov #${requestId} uchun yangi olib ketish vaqtini kiriting.\n` +
            `Format: <code>KK.OO.YYYY SS:DD</code>\n` +
            `Masalan: <code>20.07.2026 20:00</code>\n\n` +
            `/cancel — bekor`,
          { parse_mode: "HTML" }
        );
        return true;
      }
    } catch (err) {
      const msg =
        err instanceof EarlyReturnError ? err.message : err.message || "Xatolik";
      logger.error("Admin early return action failed", {
        action,
        requestId,
        error: err.message,
      });
      await bot.sendMessage(chatId, `❗️ ${msg}`);
      return true;
    }

    return false;
  });
}

async function handleAdminEarlyReturnMessage(bot, chatId, msg, session) {
  if (session.step !== RESCHEDULE_STEP) return false;
  const text = (msg.text || "").trim();
  if (/^\/cancel\b/i.test(text)) {
    sessionStore.clearSession(chatId);
    await bot.sendMessage(chatId, "❌ Vaqt o'zgartirish bekor qilindi.");
    return true;
  }

  const requestId = session.data?._erRequestId;
  const when = earlyReturnService.parseCustomPickupTime(text);
  if (!when) {
    await bot.sendMessage(chatId, "Format: KK.OO.YYYY SS:DD");
    return true;
  }

  const telegramId = msg.from.id;
  const adminRecord = await prisma.admin.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });

  try {
    const req = await earlyReturnService.reschedulePickup(requestId, when, {
      adminId: adminRecord?.id,
      adminTelegramId: telegramId,
    });
    sessionStore.clearSession(chatId);
    await bot.sendMessage(
      chatId,
      `✅ Yangi vaqt saqlandi: ${formatDatetime(req.requestedPickupTime)}\n` +
        `Mijozga xabar yuborildi. So'rov hali PENDING — Tasdiqlash/Rad etish kerak.`
    );
  } catch (err) {
    await bot.sendMessage(chatId, `❗️ ${err.message}`);
  }
  return true;
}

module.exports = {
  registerAdminEarlyReturnHandlers,
  handleAdminEarlyReturnMessage,
  RESCHEDULE_STEP,
};
