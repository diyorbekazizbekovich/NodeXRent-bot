const { TIMELINE_LABELS, label } = require("../constants/orderStatus");
const { formatDatetime } = require("../utils/dateHelper");

function buildOrderTimeline(order) {
  const logs = order.statusLogs || [];
  if (logs.length === 0) {
    return `📜 *Buyurtma #${order.id}*\n\n• ${TIMELINE_LABELS.PENDING || "Buyurtma yaratildi"}`;
  }

  const lines = [`📜 *Buyurtma #${order.id} — timeline*`, ""];
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const stepLabel = TIMELINE_LABELS[log.status] || label(log.status);
    const time = formatDatetime(log.changedAt);
    lines.push(`${i === logs.length - 1 ? "✅" : "↓"} ${stepLabel}`);
    lines.push(`   _${time}_`);
    if (i < logs.length - 1) lines.push("");
  }
  return lines.join("\n");
}

module.exports = { buildOrderTimeline };
