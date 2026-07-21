/**
 * Operational / workflow card for courier "Batafsil" view.
 */
const { label: statusLabel } = require("../../constants/orderStatus");
const { formatDatetime } = require("../../utils/dateHelper");
const { escapeHtml } = require("../../utils/telegramFormat");
const { buildReturnSummary, formatReturnSection } = require("./returnSummary.service");
const { formatTimelineSection } = require("./timeline.service");
const { buildInventorySummary } = require("./inventorySummary.service");

function formatUnitHistory(history = []) {
  if (!history.length) return "• —";
  return history
    .slice(0, 12)
    .map((h) => {
      const from = h.fromStatus || "?";
      const to = h.toStatus || "?";
      return (
        `• ${escapeHtml(h.action || "STATUS")}: ${escapeHtml(from)} → ${escapeHtml(to)}\n` +
        `   <i>${escapeHtml(formatDatetime(h.createdAt))}</i>` +
        (h.note ? `\n   ${escapeHtml(h.note)}` : "")
      );
    })
    .join("\n");
}

function formatCourierOpsCard(summary) {
  const o = summary.order;
  const inv = summary.inventory || buildInventorySummary(o);
  const ret = summary.returnInfo || buildReturnSummary(o);
  const unit = o.inventoryUnit;
  const history = unit?.history || [];

  const itemLines = (o.orderItems || [])
    .map((l) => {
      const item = l.inventoryItem;
      if (!item) return null;
      return (
        `• ${escapeHtml(l.role)} ${escapeHtml(item.inventoryNumber || "—")} — ` +
        `<b>${escapeHtml(item.status || "—")}</b>` +
        (l.returnedAt ? ` (qaytarilgan ${escapeHtml(formatDatetime(l.returnedAt))})` : "")
      );
    })
    .filter(Boolean);

  return (
    `⚙️ <b>Operatsion ma'lumot — #${o.id}</b>\n\n` +
    `📌 Buyurtma: <b>${escapeHtml(statusLabel(o.status))}</b>\n` +
    `🎮 Qurilma: <b>${escapeHtml(inv.unitCode)}</b>\n` +
    `📦 Unit status: <b>${escapeHtml(unit?.status || "—")}</b>\n` +
    `🚚 Kuryer: ${escapeHtml(o.courier?.fullName || "—")} (#${o.courierId || "—"})\n` +
    `\n━━━━━━━━━━━━━━\n\n` +
    `📦 <b>Inventar holatlari</b>\n` +
    (itemLines.length ? itemLines.join("\n") : "• —") +
    `\n\n━━━━━━━━━━━━━━\n\n` +
    formatReturnSection(ret) +
    `\n\n━━━━━━━━━━━━━━\n\n` +
    `🚚 <b>Yetkazish / qaytarish</b>\n` +
    `Accepted: ${escapeHtml(formatDatetime(o.acceptedAt))}\n` +
    `Yo'lda: ${escapeHtml(formatDatetime(o.deliveryStartedAt))}\n` +
    `Yetkazildi: ${escapeHtml(formatDatetime(o.deliveryCompletedAt || o.rentalStartAt))}\n` +
    `Olib ketildi: ${escapeHtml(formatDatetime(o.pickedUpAt || o.returnedAt))}\n` +
    `\n━━━━━━━━━━━━━━\n\n` +
    `🛠 <b>Unit tarixi (maintenance)</b>\n` +
    formatUnitHistory(history) +
    `\n\n━━━━━━━━━━━━━━\n\n` +
    formatTimelineSection(o)
  );
}

module.exports = {
  formatCourierOpsCard,
  formatUnitHistory,
};
