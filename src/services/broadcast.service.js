const prisma = require("../config/prisma");
const logger = require("../utils/logger");

const RATE_LIMIT_MS = 35;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function detectMediaType(msg) {
  if (msg.photo?.length) return "photo";
  if (msg.video) return "video";
  if (msg.video_note) return "video_note";
  if (msg.voice) return "voice";
  if (msg.audio) return "audio";
  if (msg.animation) return "animation";
  if (msg.sticker) return "sticker";
  if (msg.document) return "document";
  if (msg.contact) return "contact";
  if (msg.location) return "location";
  return "text";
}

function buildPayload(msg) {
  const type = detectMediaType(msg);
  const payload = {
    type,
    caption: msg.caption || null,
    caption_entities: msg.caption_entities || null,
    parse_mode: msg.parse_mode || (msg.caption ? undefined : undefined),
  };

  if (type === "text") {
    payload.text = msg.text || "";
    payload.entities = msg.entities || null;
  } else if (type === "photo") {
    payload.fileId = msg.photo[msg.photo.length - 1].file_id;
  } else if (type === "video") {
    payload.fileId = msg.video.file_id;
  } else if (type === "video_note") {
    payload.fileId = msg.video_note.file_id;
  } else if (type === "voice") {
    payload.fileId = msg.voice.file_id;
  } else if (type === "audio") {
    payload.fileId = msg.audio.file_id;
  } else if (type === "animation") {
    payload.fileId = msg.animation.file_id;
  } else if (type === "sticker") {
    payload.fileId = msg.sticker.file_id;
  } else if (type === "document") {
    payload.fileId = msg.document.file_id;
  } else if (type === "contact") {
    payload.phoneNumber = msg.contact.phone_number;
    payload.firstName = msg.contact.first_name;
    payload.lastName = msg.contact.last_name || null;
  } else if (type === "location") {
    payload.latitude = msg.location.latitude;
    payload.longitude = msg.location.longitude;
  }

  if (msg.reply_markup) {
    payload.reply_markup = msg.reply_markup;
  }

  return payload;
}

function buildSendOptions(payload) {
  const opts = {};
  if (payload.reply_markup) opts.reply_markup = payload.reply_markup;

  if (payload.caption) {
    opts.caption = payload.caption;
    if (payload.caption_entities?.length) {
      opts.caption_entities = payload.caption_entities;
    } else if (payload.parse_mode) {
      opts.parse_mode = payload.parse_mode;
    }
  }

  return opts;
}

async function sendPayload(bot, chatId, payload) {
  if (payload.type === "text" && !payload.text?.trim()) {
    throw new Error("Matn bo'sh");
  }

  const mediaOpts = buildSendOptions(payload);

  switch (payload.type) {
    case "text": {
      const textOpts = { ...mediaOpts };
      if (payload.entities?.length) {
        textOpts.entities = payload.entities;
      } else if (payload.parse_mode) {
        textOpts.parse_mode = payload.parse_mode;
      }
      delete textOpts.caption;
      delete textOpts.caption_entities;
      return bot.sendMessage(chatId, payload.text, textOpts);
    }
    case "photo":
      return bot.sendPhoto(chatId, payload.fileId, mediaOpts);
    case "video":
      return bot.sendVideo(chatId, payload.fileId, mediaOpts);
    case "video_note":
      return bot.sendVideoNote(chatId, payload.fileId, mediaOpts);
    case "voice":
      return bot.sendVoice(chatId, payload.fileId, mediaOpts);
    case "audio":
      return bot.sendAudio(chatId, payload.fileId, mediaOpts);
    case "animation":
      return bot.sendAnimation(chatId, payload.fileId, mediaOpts);
    case "sticker":
      return bot.sendSticker(chatId, payload.fileId, mediaOpts);
    case "document":
      return bot.sendDocument(chatId, payload.fileId, mediaOpts);
    case "contact":
      return bot.sendContact(chatId, payload.phoneNumber, payload.firstName, {
        last_name: payload.lastName || undefined,
      });
    case "location":
      return bot.sendLocation(chatId, payload.latitude, payload.longitude);
    default:
      throw new Error("Noma'lum media turi");
  }
}

async function saveCampaign(adminId, payload, stats) {
  const summaryText =
    payload.type === "text" ? payload.text : `[${payload.type}] ${payload.caption || ""}`;
  const message = summaryText.slice(0, 2000) || `[${payload.type}]`;

  try {
    await prisma.adCampaign.create({
      data: {
        adminId,
        message,
        mediaType: payload.type,
        payload,
        recipientCount: stats.total,
        successCount: stats.success,
        failCount: stats.failed,
      },
    });
  } catch (err) {
    logger.warn("AdCampaign to'liq saqlanmadi, raw SQL fallback", { error: err.message });
    await prisma.$executeRaw`
      INSERT INTO playstation_rental.ad_campaigns ("adminId", message, "recipientCount", "sentAt")
      VALUES (${adminId}, ${message}, ${stats.success}, NOW())
    `;
  }
}

async function broadcast(bot, msg, adminId, progressCallback) {
  const payload = buildPayload(msg);
  const users = await prisma.user.findMany({ where: { isBlocked: false } });
  const total = users.length;
  let success = 0;
  let failed = 0;

  if (total === 0) {
    return { total: 0, success: 0, failed: 0, mediaType: payload.type };
  }

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    try {
      await sendPayload(bot, u.telegramId.toString(), payload);
      success++;
    } catch (err) {
      failed++;
      logger.warn("Broadcast xatoligi", { userId: u.id, error: err.message });
    }

    if (progressCallback && (i % 5 === 0 || i === users.length - 1)) {
      const pct = Math.round(((i + 1) / total) * 100);
      await progressCallback({ pct, success, failed, total, done: i + 1 });
    }

    await sleep(RATE_LIMIT_MS);
  }

  await saveCampaign(adminId, payload, { total, success, failed });

  return { total, success, failed, mediaType: payload.type };
}

module.exports = { detectMediaType, buildPayload, broadcast, sendPayload };
