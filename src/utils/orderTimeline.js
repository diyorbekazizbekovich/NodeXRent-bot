const { TIMELINE_LABELS, label } = require("../constants/orderStatus");
const { formatDatetime } = require("./dateHelper");
const { escapeHtml } = require("./telegramFormat");

function buildOrderTimeline(order) {
  const logs = order.statusLogs || [];
  if (logs.length === 0) {
    return `📜 <b>Buyurtma #${order.id}</b>\n\n• ${escapeHtml(TIMELINE_LABELS.PENDING || "Buyurtma yaratildi")}`;
  }

  const lines = [`📜 <b>Buyurtma #${order.id} — timeline</b>`, ""];
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const stepLabel = TIMELINE_LABELS[log.status] || label(log.status);
    const time = formatDatetime(log.changedAt);
    lines.push(`${i === logs.length - 1 ? "✅" : "↓"} ${escapeHtml(stepLabel)}`);
    lines.push(`   <i>${escapeHtml(time)}</i>`);
    if (i < logs.length - 1) lines.push("");
  }
  return lines.join("\n");
}

module.exports = { buildOrderTimeline };
