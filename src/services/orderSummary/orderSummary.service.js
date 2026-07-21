/**
 * Courier / ops full order card — single efficient Prisma load + formatters.
 */
const prisma = require("../../config/prisma");
const { label: statusLabel } = require("../../constants/orderStatus");
const { labelCollateral } = require("../../constants/deliveryHandover");
const rentalReturnService = require("../rentalReturn.service");
const {
  formatRemainingDuration,
  formatDatetime,
} = require("../../utils/dateHelper");
const { escapeHtml } = require("../../utils/telegramFormat");
const { buildPaymentSummary, formatPaymentSection } = require("./paymentSummary.service");
const { buildInventorySummary, formatInventorySection } = require("./inventorySummary.service");
const { buildReturnSummary, formatReturnSection } = require("./returnSummary.service");
const { formatTimelineSection } = require("./timeline.service");

const DETAIL_INCLUDE = {
  user: true,
  courier: true,
  inventoryUnit: true,
  consoleItem: true,
  hdmiItem: true,
  powerItem: true,
  promocode: true,
  rentalPrice: { include: { consoleCatalog: true } },
  payments: { orderBy: { createdAt: "asc" } },
  extensions: { orderBy: { requestedAt: "asc" } },
  orderItems: { include: { inventoryItem: true } },
  contract: true,
  photos: true,
  statusLogs: { orderBy: { changedAt: "asc" } },
  returnRequests: { orderBy: { createdAt: "desc" } },
};

async function loadOrderForSummary(orderId) {
  return prisma.order.findUnique({
    where: { id: Number(orderId) },
    include: DETAIL_INCLUDE,
  });
}

function googleMapsUrl(lat, lon) {
  if (lat == null || lon == null) return null;
  return `https://maps.google.com/?q=${lat},${lon}`;
}

function rentalDurationHours(order) {
  if (order.rentalPrice?.hours != null) return Number(order.rentalPrice.hours);
  if (order.rentalPrice?.duration != null) return Number(order.rentalPrice.duration);
  const start = order.rentalStartAt || order.startDatetime;
  const end = order.expectedReturnAt || order.endDatetime;
  if (start && end) {
    return Math.max(1, Math.round((new Date(end) - new Date(start)) / 3600000));
  }
  return null;
}

function buildOrderSummary(order) {
  const payment = buildPaymentSummary(order);
  const inventory = buildInventorySummary(order);
  const ret = buildReturnSummary(order);
  const end = rentalReturnService.getExpectedReturnAt(order);
  const remaining = end ? formatRemainingDuration(end) : "—";
  const ended = rentalReturnService.isRentalPeriodEnded(order);
  const maps = googleMapsUrl(order.latitude, order.longitude);
  const handoverPhoto = (order.photos || []).find((p) => p.photoType === "HANDOVER");
  const durationH = rentalDurationHours(order);

  return {
    order,
    payment,
    inventory,
    returnInfo: ret,
    remaining,
    ended,
    mapsUrl: maps,
    contractNumber: order.contract?.contractNumber || null,
    contractDate: order.contract?.createdAt || null,
    hasHandoverPhoto: Boolean(handoverPhoto),
    collateralType: order.collateralType || null,
    durationHours: durationH,
  };
}

/**
 * Compact card matching courier field UX (fits Telegram limit).
 */
function formatCourierOrderCard(summary) {
  const o = summary.order;
  const u = o.user;
  const inv = summary.inventory;
  const pay = summary.payment;
  const { money } = require("./paymentSummary.service");

  const jsLines =
    inv.joysticks.length > 0
      ? inv.joysticks.map((j) => `• ${escapeHtml(j.code)}`).join("\n")
      : "• —";

  const extLines =
    pay.extensionLines.length > 0
      ? pay.extensionLines.map((e) => e.label).join("\n")
      : "—";

  const mapsLine = summary.mapsUrl
    ? `🗺 <a href="${summary.mapsUrl}">Google Maps</a>`
    : "🗺 —";

  return (
    `📦 <b>Buyurtma #${o.id}</b>\n\n` +
    `👤 ${escapeHtml(u?.fullName || "—")}\n` +
    `📞 ${escapeHtml(u?.phone || "—")}\n` +
    `🆔 <code>${escapeHtml(String(u?.telegramId || "—"))}</code>\n\n` +
    `📍 ${escapeHtml(o.address || "—")}\n` +
    `${mapsLine}\n` +
    (o.latitude != null
      ? `<i>${Number(o.latitude).toFixed(5)}, ${Number(o.longitude).toFixed(5)}</i>\n`
      : "") +
    `\n━━━━━━━━━━━━━━\n\n` +
    `🎮 <b>${escapeHtml(inv.unitCode)}</b>\n` +
    `🔢 Serial: ${escapeHtml(inv.serialNumber || "—")}\n\n` +
    `🎮 Joystick:\n${jsLines}\n\n` +
    `📺 HDMI: ${
      inv.hdmi.length ? inv.hdmi.map((h) => escapeHtml(h.code)).join(", ") : "—"
    }\n` +
    `🔌 Power: ${
      inv.power.length ? inv.power.map((p) => escapeHtml(p.code)).join(", ") : "—"
    }\n` +
    `\n━━━━━━━━━━━━━━\n\n` +
    `💰 <b>To'lov</b>\n\n` +
    `Ijara:\n${money(pay.baseRental)}\n\n` +
    `Yetkazib berish:\n${money(pay.deliveryFee)}\n\n` +
    `Uzaytirish:\n${extLines}\n\n` +
    `Chegirma` +
    (pay.promoCode ? ` (${escapeHtml(pay.promoCode)})` : "") +
    `:\n${money(pay.discount)}\n\n` +
    (pay.deposit > 0 ? `Depozit:\n${money(pay.deposit)}\n\n` : "") +
    `Jami:\n${money(pay.expectedDue)}\n\n` +
    `To'langan:\n${money(pay.totalPaid)}\n\n` +
    `Qarz:\n${money(pay.outstanding)}\n\n` +
    `Usul: ${escapeHtml(pay.paymentMethodLabel)}\n` +
    `\n━━━━━━━━━━━━━━\n\n` +
    `📌 Status: <b>${escapeHtml(statusLabel(o.status))}</b>\n` +
    `▶️ Boshlanish: ${escapeHtml(formatDatetime(o.rentalStartAt || o.startDatetime))}\n` +
    `⏹ Tugash: ${escapeHtml(formatDatetime(o.expectedReturnAt || o.endDatetime))}\n` +
    (summary.durationHours != null ? `⏱ Muddat: ${summary.durationHours} soat\n` : "") +
    `⏳ Qolgan vaqt:\n<b>${escapeHtml(summary.remaining)}</b>\n` +
    `\n━━━━━━━━━━━━━━\n\n` +
    `↩️ Qaytarish so'rovi: <b>${summary.returnInfo.hasRequest ? "HA" : "YO'Q"}</b>\n` +
    `\n━━━━━━━━━━━━━━\n\n` +
    `📋 Hujjat: ${escapeHtml(labelCollateral(summary.collateralType) || "—")}\n` +
    `📄 Shartnoma: ${
      summary.contractNumber
        ? `#${escapeHtml(summary.contractNumber)}`
        : "—"
    }\n` +
    `📸 Surat: ${summary.hasHandoverPhoto ? "Bor" : "Yo'q"}`
  );
}

function formatCourierListItem(order) {
  const unit = order.inventoryUnit?.unitCode || order.consoleType;
  const remaining = formatRemainingDuration(
    rentalReturnService.getExpectedReturnAt(order)
  );
  return (
    `📦 <b>#${order.id}</b> — ${escapeHtml(unit)}\n` +
    `👤 ${escapeHtml(order.user?.fullName || "—")}\n` +
    `📌 ${escapeHtml(statusLabel(order.status))}\n` +
    `⏳ ${escapeHtml(remaining)}`
  );
}

async function getCourierOrderDetail(orderId) {
  const order = await loadOrderForSummary(orderId);
  if (!order) return null;
  return buildOrderSummary(order);
}

module.exports = {
  DETAIL_INCLUDE,
  loadOrderForSummary,
  buildOrderSummary,
  formatCourierOrderCard,
  formatCourierListItem,
  formatPaymentSection,
  formatInventorySection,
  formatReturnSection,
  formatTimelineSection,
  getCourierOrderDetail,
  googleMapsUrl,
};
