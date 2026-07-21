/**
 * Order lifecycle timeline from statusLogs (+ extension markers).
 */
const { TIMELINE_LABELS, label } = require("../../constants/orderStatus");
const { formatDatetime } = require("../../utils/dateHelper");
const { escapeHtml } = require("../../utils/telegramFormat");

function buildTimeline(order) {
  const events = [];

  for (const log of order.statusLogs || []) {
    events.push({
      at: log.changedAt,
      status: log.status,
      label: TIMELINE_LABELS[log.status] || label(log.status),
      note: log.note || null,
      kind: "status",
    });
  }

  for (const ext of order.extensions || []) {
    if (ext.status === "APPROVED") {
      events.push({
        at: ext.resolvedAt || ext.requestedAt,
        status: "EXTENSION",
        label: `Uzaytirish +${ext.extraHours} soat`,
        note: null,
        kind: "extension",
      });
    }
  }

  for (const rr of order.returnRequests || []) {
    events.push({
      at: rr.createdAt,
      status: "EARLY_RETURN",
      label: `Erta qaytarish so'rovi (${rr.status})`,
      note: null,
      kind: "return",
    });
  }

  events.sort((a, b) => new Date(a.at) - new Date(b.at));
  return events;
}

function formatTimelineSection(order) {
  const events = buildTimeline(order);
  if (!events.length) {
    return `📜 <b>Tarix</b>\n\n• Buyurtma yaratildi`;
  }
  const lines = [`📜 <b>Tarix</b>`, ""];
  events.forEach((e, i) => {
    const mark = i === events.length - 1 ? "✅" : "•";
    lines.push(`${mark} ${escapeHtml(e.label)}`);
    lines.push(`   <i>${escapeHtml(formatDatetime(e.at))}</i>`);
  });
  return lines.join("\n");
}

module.exports = {
  buildTimeline,
  formatTimelineSection,
};
