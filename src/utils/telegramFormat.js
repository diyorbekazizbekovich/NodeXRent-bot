/**
 * Telegram Bot API entity escaping helpers.
 * @see https://core.telegram.org/bots/api#formatting-options
 */

function asString(value) {
  if (value == null) return "";
  return String(value);
}

/** Escape for parse_mode: HTML */
function escapeHtml(value) {
  return asString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escape for legacy parse_mode: Markdown
 * Special: _ * ` [
 */
function escapeMarkdown(value) {
  return asString(value).replace(/([_*`\[])/g, "\\$1");
}

/**
 * Escape for parse_mode: MarkdownV2
 * Special: _ * [ ] ( ) ~ ` > # + - = | { } . ! \
 */
function escapeMarkdownV2(value) {
  return asString(value).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

/**
 * Escape dynamic value according to parse_mode.
 * @param {unknown} value
 * @param {"HTML"|"Markdown"|"MarkdownV2"|string|undefined|null} parseMode
 */
function escapeForParseMode(value, parseMode) {
  const mode = parseMode || "HTML";
  if (mode === "HTML") return escapeHtml(value);
  if (mode === "MarkdownV2") return escapeMarkdownV2(value);
  if (mode === "Markdown") return escapeMarkdown(value);
  return asString(value);
}

/**
 * Preview + length helpers for diagnostics.
 */
function messagePreview(text, limit = 300) {
  const s = asString(text);
  if (s.length <= limit) return s;
  return `${s.slice(0, limit)}…`;
}

function utf8ByteLength(text) {
  return Buffer.byteLength(asString(text), "utf8");
}

/**
 * Extract Telegram entity offset from error message if present.
 */
function parseEntityByteOffset(errorMessage) {
  const m = String(errorMessage || "").match(/byte offset (\d+)/i);
  return m ? Number(m[1]) : null;
}

/**
 * Show surrounding characters around a byte offset (UTF-8).
 */
function snippetAroundByteOffset(text, byteOffset, radius = 40) {
  const buf = Buffer.from(asString(text), "utf8");
  if (byteOffset == null || byteOffset < 0 || byteOffset > buf.length) {
    return null;
  }
  const start = Math.max(0, byteOffset - radius);
  const end = Math.min(buf.length, byteOffset + radius);
  return {
    byteOffset,
    before: buf.slice(start, byteOffset).toString("utf8"),
    at: buf.slice(byteOffset, Math.min(buf.length, byteOffset + 1)).toString("utf8"),
    after: buf.slice(byteOffset, end).toString("utf8"),
    window: buf.slice(start, end).toString("utf8"),
  };
}

module.exports = {
  escapeHtml,
  escapeMarkdown,
  escapeMarkdownV2,
  escapeForParseMode,
  messagePreview,
  utf8ByteLength,
  parseEntityByteOffset,
  snippetAroundByteOffset,
};
