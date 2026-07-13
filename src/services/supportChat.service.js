const supportChatRepository = require("../repositories/supportChat.repository");
const { buildPayload, sendPayload } = require("./broadcast.service");
const { getAdminRecipients } = require("../utils/adminRecipients");
const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const { formatDatetime } = require("../utils/dateHelper");
const { escapeHtml } = require("../utils/telegramFormat");

const HEADER =
  "━━━━━━━━━━━━━━\n📩 NodeXRent qo'llab-quvvatlash xizmati\n━━━━━━━━━━━━━━";

const processingLocks = new Set();

class SupportChatError extends Error {
  constructor(message, code = "SUPPORT_ERROR") {
    super(message);
    this.code = code;
  }
}

function userReplyKeyboard(threadId) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "💬 Javob berish", callback_data: `user:support:reply:${threadId}` }]],
    },
  };
}

function adminReplyKeyboard(userId) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "✍️ Javob yozish", callback_data: `admin:support:reply:${userId}` }]],
    },
  };
}

function hasRelayContent(msg) {
  return Boolean(
    msg.text ||
      msg.photo ||
      msg.video ||
      msg.video_note ||
      msg.voice ||
      msg.audio ||
      msg.animation ||
      msg.sticker ||
      msg.document ||
      msg.contact ||
      msg.location
  );
}

function formatCustomerReplyHeader(user) {
  return (
    "━━━━━━━━━━━━━━\n" +
    "💬 Mijoz javob berdi\n\n" +
    `👤 Ism: ${user.fullName || "—"}\n` +
    `Telefon: ${user.phone || "—"}\n` +
    `Telegram ID: ${user.telegramId}\n` +
    "━━━━━━━━━━━━━━"
  );
}

function formatHistory(messages) {
  if (!messages.length) return "💬 Chat tarixi bo'sh.";
  const lines = ["💬 <b>Chat tarixi</b> (oxirgi xabarlar)", ""];
  for (const m of [...messages].reverse()) {
    const who = m.senderType === "ADMIN" ? "👨‍💼 Admin" : "👤 Mijoz";
    const body =
      m.messageType === "text"
        ? escapeHtml((m.text || "").slice(0, 200))
        : escapeHtml(
            `[${m.messageType}]${m.caption ? " " + m.caption.slice(0, 120) : ""}`
          );
    lines.push(`${who} · ${escapeHtml(formatDatetime(m.createdAt))}`);
    lines.push(body || "—");
    lines.push("");
  }
  return lines.join("\n").slice(0, 3900);
}

async function resolveAdminRecord(telegramId, fullName) {
  return prisma.admin.upsert({
    where: { telegramId: BigInt(telegramId) },
    update: {},
    create: { telegramId: BigInt(telegramId), fullName: fullName || null },
  });
}

/**
 * Admin → mijoz xabar
 */
async function sendAdminToUser({ bot, adminTelegramId, adminFullName, userId, msg }) {
  if (!hasRelayContent(msg)) {
    throw new SupportChatError("Matn yoki media yuboring.", "EMPTY");
  }

  const lockKey = `admin:${userId}:${adminTelegramId}`;
  if (processingLocks.has(lockKey)) {
    throw new SupportChatError("⏳ Xabar yuborilmoqda...", "BUSY");
  }
  processingLocks.add(lockKey);

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new SupportChatError("Mijoz topilmadi.", "NOT_FOUND");
    if (user.isBlocked) throw new SupportChatError("Mijoz bloklangan.", "BLOCKED");

    const admin = await resolveAdminRecord(adminTelegramId, adminFullName);
    const thread = await supportChatRepository.getOrCreateThread(userId);
    const payload = buildPayload(msg);

    const saved = await supportChatRepository.createMessage({
      threadId: thread.id,
      senderType: "ADMIN",
      senderAdminId: admin.id,
      messageType: payload.type,
      text: payload.text || null,
      caption: payload.caption || null,
      fileId: payload.fileId || null,
      payload,
    });

    const targetChatId = user.telegramId.toString();
    const replyKb = userReplyKeyboard(thread.id);

    await bot.sendMessage(targetChatId, HEADER);

    let sent;
    if (payload.type === "text") {
      sent = await bot.sendMessage(targetChatId, payload.text, replyKb);
    } else {
      sent = await sendPayload(bot, targetChatId, { ...payload, reply_markup: replyKb.reply_markup });
      // Media turlarida tugma caption bilan birga ketishi mumkin emas (video_note/sticker) —
      // shunda alohida tugma yuboramiz
      if (["video_note", "sticker", "contact", "location"].includes(payload.type)) {
        await bot.sendMessage(targetChatId, "💬 Javob berish uchun tugmani bosing:", replyKb);
      }
    }

    if (sent?.message_id) {
      await prisma.supportMessage.update({
        where: { id: saved.id },
        data: { telegramMessageId: BigInt(sent.message_id) },
      });
    }

    return { thread, message: saved, user };
  } finally {
    processingLocks.delete(lockKey);
  }
}

/**
 * Mijoz → adminlar
 */
async function sendUserToAdmins({ bot, user, msg }) {
  if (!hasRelayContent(msg)) {
    throw new SupportChatError("Matn yoki media yuboring.", "EMPTY");
  }

  const lockKey = `user:${user.id}`;
  if (processingLocks.has(lockKey)) {
    throw new SupportChatError("⏳ Xabar yuborilmoqda...", "BUSY");
  }
  processingLocks.add(lockKey);

  try {
    const thread = await supportChatRepository.getOrCreateThread(user.id);
    const payload = buildPayload(msg);

    const saved = await supportChatRepository.createMessage({
      threadId: thread.id,
      senderType: "USER",
      senderUserId: user.id,
      messageType: payload.type,
      text: payload.text || null,
      caption: payload.caption || null,
      fileId: payload.fileId || null,
      payload,
    });

    const header = formatCustomerReplyHeader(user);
    const replyKb = adminReplyKeyboard(user.id);
    const admins = await getAdminRecipients();

    for (const admin of admins) {
      try {
        await bot.sendMessage(admin.telegramId, header);
        if (payload.type === "text") {
          await bot.sendMessage(admin.telegramId, payload.text, replyKb);
        } else {
          await sendPayload(bot, admin.telegramId, {
            ...payload,
            reply_markup: replyKb.reply_markup,
          });
          if (["video_note", "sticker", "contact", "location"].includes(payload.type)) {
            await bot.sendMessage(admin.telegramId, "✍️ Javob yozish:", replyKb);
          }
        }
      } catch (err) {
        logger.warn("Support chat admin notify failed", {
          adminTelegramId: admin.telegramId,
          error: err.message,
        });
      }
    }

    return { thread, message: saved };
  } finally {
    processingLocks.delete(lockKey);
  }
}

async function getChatHistory(userId, { take = 20 } = {}) {
  const thread = await supportChatRepository.findThreadByUserId(userId);
  if (!thread) return { thread: null, text: "💬 Chat tarixi bo'sh." };
  const messages = await supportChatRepository.listMessages(thread.id, { take });
  return { thread, text: formatHistory(messages) };
}

async function assertThreadOwnedByUser(threadId, userId) {
  const thread = await supportChatRepository.findThreadById(threadId);
  if (!thread || thread.userId !== userId) {
    throw new SupportChatError("Ruxsat yo'q.", "FORBIDDEN");
  }
  return thread;
}

module.exports = {
  SupportChatError,
  hasRelayContent,
  sendAdminToUser,
  sendUserToAdmins,
  getChatHistory,
  assertThreadOwnedByUser,
  userReplyKeyboard,
  adminReplyKeyboard,
  HEADER,
};
