/**
 * Audit Log Renderer — Telegram HTML output from formatted audit entries.
 * Never includes raw JSON.
 */
const { escapeHtml } = require("../../utils/telegramFormat");
const { formatAuditEntry } = require("./auditLog.formatter");

const DIVIDER = "━━━━━━━━━━━━━━━━━━";

/**
 * Full detail card (user-readable).
 * @param {object} entry raw or pre-formatted
 */
function renderDetail(entry) {
  const f = entry.icon && entry.detailLines ? entry : formatAuditEntry(entry);
  const lines = [
    DIVIDER,
    `${f.icon} <b>${escapeHtml(f.title)}</b>`,
    "",
    "👤 <b>Admin:</b>",
    escapeHtml(f.adminLabel),
  ];

  if (f.telegramId) {
    lines.push("", "🆔 <b>Telegram ID:</b>", escapeHtml(f.telegramId));
  }

  lines.push("", "📅 <b>Sana:</b>", escapeHtml(f.date), "", "🕒 <b>Vaqt:</b>", escapeHtml(f.time));

  if (f.module) {
    lines.push("", "📂 <b>Modul:</b>", escapeHtml(f.module));
  }

  if (f.detailLines?.length) {
    lines.push("");
    for (const line of f.detailLines) {
      lines.push(escapeHtml(line));
    }
  }

  lines.push("", DIVIDER);
  return lines.join("\n");
}

/**
 * Compact one-line / short block for list view.
 */
function renderListItem(entry, index) {
  const f = entry.icon && entry.summary != null ? entry : formatAuditEntry(entry);
  const n = index != null ? `${index}. ` : "";
  return (
    `${n}${f.icon} <b>${escapeHtml(f.title)}</b>\n` +
    `   ${escapeHtml(f.date)} ${escapeHtml(f.time)} · ${escapeHtml(f.adminLabel)}\n` +
    `   ${escapeHtml(f.summary)}`
  );
}

/**
 * Full list message body (without overflowing Telegram 4096 too hard).
 */
function renderList(entries, { emptyText = "Loglar yo'q." } = {}) {
  if (!entries?.length) return emptyText;
  const formatted = entries.map(formatAuditEntry);
  const blocks = formatted.map((f, i) => renderListItem(f, i + 1));
  let text = `📋 <b>Admin loglar</b>\n\n${blocks.join("\n\n")}`;
  if (text.length > 3500) {
    text = text.slice(0, 3490) + "\n\n…";
  }
  return text;
}

/**
 * Inline keyboard: one "Tafsilotlar" button per log (max rows).
 */
function detailsKeyboard(entries, { max = 12 } = {}) {
  const rows = entries.slice(0, max).map((e) => {
    const f = formatAuditEntry(e);
    const label = `${f.icon} #${e.id} · ${f.title}`.slice(0, 64);
    return [{ text: label, callback_data: `admin:audit:view:${e.id}` }];
  });
  return { reply_markup: { inline_keyboard: rows } };
}

/**
 * Backward-compatible single-entry format (detail card).
 */
function formatEntry(entry) {
  return renderDetail(entry);
}

module.exports = {
  DIVIDER,
  renderDetail,
  renderListItem,
  renderList,
  detailsKeyboard,
  formatEntry,
};
