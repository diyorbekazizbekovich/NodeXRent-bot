/**
 * Central Telegram outbound messaging with parse diagnostics.
 * Prefer this (or notification.service) over raw bot.sendMessage when parse_mode is used.
 */
const logger = require("./logger");
const {
  messagePreview,
  utf8ByteLength,
  parseEntityByteOffset,
  snippetAroundByteOffset,
} = require("./telegramFormat");

function resolveParseMode(options = {}) {
  return options.parse_mode || options.parseMode || null;
}

function buildSendLog({
  service,
  functionName,
  chatId,
  text,
  caption,
  options = {},
  error = null,
}) {
  const body = text != null ? String(text) : caption != null ? String(caption) : "";
  const parseMode = resolveParseMode(options);
  const byteOffset = error ? parseEntityByteOffset(error.message || error) : null;
  const log = {
    context: service || "TelegramSend",
    function: functionName || "send",
    chatId: chatId != null ? String(chatId) : undefined,
    parse_mode: parseMode,
    textLength: text != null ? String(text).length : 0,
    captionLength: caption != null ? String(caption).length : 0,
    utf8Bytes: utf8ByteLength(body),
    preview: messagePreview(body, 300),
  };
  if (byteOffset != null) {
    log.entityByteOffset = byteOffset;
    log.entitySnippet = snippetAroundByteOffset(body, byteOffset);
  }
  return log;
}

async function sendMessageSafe(bot, chatId, text, options = {}, meta = {}) {
  const parseMode = resolveParseMode(options);
  logger.info("Telegram sendMessage", buildSendLog({
    service: meta.service,
    functionName: meta.fn || "sendMessage",
    chatId,
    text,
    options,
  }));

  try {
    return await bot.sendMessage(chatId, text, options);
  } catch (err) {
    const isParse =
      /can't parse entities|parse entities|unsupported start tag|unclosed start tag/i.test(
        err.message || ""
      );
    logger[isParse ? "error" : "warn"]("Telegram sendMessage failed", {
      ...buildSendLog({
        service: meta.service,
        functionName: meta.fn || "sendMessage",
        chatId,
        text,
        options,
        error: err,
      }),
      error: err.message,
      parse_mode: parseMode,
    });
    throw err;
  }
}

async function editMessageTextSafe(bot, text, options = {}, meta = {}) {
  const chatId = options.chat_id;
  logger.info("Telegram editMessageText", buildSendLog({
    service: meta.service,
    functionName: meta.fn || "editMessageText",
    chatId,
    text,
    options,
  }));

  try {
    return await bot.editMessageText(text, options);
  } catch (err) {
    const isParse = /can't parse entities|parse entities/i.test(err.message || "");
    logger[isParse ? "error" : "warn"]("Telegram editMessageText failed", {
      ...buildSendLog({
        service: meta.service,
        functionName: meta.fn || "editMessageText",
        chatId,
        text,
        options,
        error: err,
      }),
      error: err.message,
    });
    throw err;
  }
}

module.exports = {
  sendMessageSafe,
  editMessageTextSafe,
  buildSendLog,
  resolveParseMode,
  installTelegramOutboundLogging,
};

/**
 * Wrap bot.sendMessage / editMessageText with parse diagnostics (does not swallow errors).
 */
function installTelegramOutboundLogging(bot) {
  if (!bot || bot.__telegramOutboundLoggingInstalled) return bot;

  const originalSend = bot.sendMessage.bind(bot);
  const originalEdit = bot.editMessageText.bind(bot);

  bot.sendMessage = async function sendMessageLogged(chatId, text, options = {}) {
    return sendMessageSafe(
      { sendMessage: originalSend },
      chatId,
      text,
      options || {},
      { service: "Bot.sendMessage", fn: "sendMessage" }
    );
  };

  bot.editMessageText = async function editMessageTextLogged(text, options = {}) {
    return editMessageTextSafe(
      { editMessageText: originalEdit },
      text,
      options || {},
      { service: "Bot.editMessageText", fn: "editMessageText" }
    );
  };

  bot.__telegramOutboundLoggingInstalled = true;
  return bot;
}
