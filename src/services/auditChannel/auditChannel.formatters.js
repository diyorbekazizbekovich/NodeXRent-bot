/**
 * HTML formatters for official Audit Channel posts.
 */
const { escapeHtml } = require("../../utils/telegramFormat");
const { formatDatetime } = require("../../utils/dateHelper");
const { labelCollateral, labelHandoverPayment } = require("../../constants/deliveryHandover");
const { buildPaymentSummary } = require("../orderSummary/paymentSummary.service");
const { buildInventorySummary } = require("../orderSummary/inventorySummary.service");
const {
  HASHTAG,
  AuditChannelEvent,
  displayInventoryStatus,
} = require("../../constants/auditChannel");

const DIV = "━━━━━━━━━━━━━━━━━━━━";

function moneyPlain(n) {
  return Number(n || 0).toLocaleString("uz-UZ");
}

function mapsLink(lat, lon) {
  if (lat == null || lon == null) return "—";
  return `https://maps.google.com/?q=${lat},${lon}`;
}

function usernameLine(u) {
  if (!u?.username) return "—";
  return `@${escapeHtml(String(u.username).replace(/^@/, ""))}`;
}

function resolveConfirmingAdmin(order) {
  const log = (order.statusLogs || []).find((l) => l.status === "ADMIN_CONFIRMED");
  if (!log?.actorId && !log) return order._confirmingAdminName || "—";
  return order._confirmingAdminName || (log?.actorId ? `Admin #${log.actorId}` : "—");
}

function formatDeliveryCompleted(order, meta = {}) {
  const inv = buildInventorySummary(order);
  const pay = buildPaymentSummary(order);
  const user = order.user || {};
  const courier = order.courier || {};
  const js =
    (meta.joysticks || inv.joysticks || []).map((j) =>
      escapeHtml(j.inventoryNumber || j.code || "—")
    );
  const hdmi =
    meta.hdmi?.inventoryNumber ||
    (inv.hdmi[0] && inv.hdmi[0].code) ||
    "—";
  const power =
    meta.power?.inventoryNumber ||
    (inv.power[0] && inv.power[0].code) ||
    "—";
  const collateral = labelCollateral(meta.collateralType || order.collateralType);
  const payment = labelHandoverPayment(meta.paymentMethod || order.paymentMethod);
  const base = meta.basePrice != null ? meta.basePrice : pay.baseRental;
  const delivery = meta.deliveryFee != null ? meta.deliveryFee : pay.deliveryFee;
  const total = meta.finalPaidAmount != null ? meta.finalPaidAmount : pay.totalPaid;
  const unitCode = meta.unitCode || inv.unitCode;
  const serial = order.inventoryUnit?.serialNumber || meta.console?.serialNumber || "—";
  const tag = HASHTAG[AuditChannelEvent.DELIVERY_COMPLETED];

  return (
    `${tag}\n\n` +
    `${DIV}\n\n` +
    `📦 <b>Buyurtma</b>\n\n#${order.id}\n\n` +
    `${DIV}\n\n` +
    `👤 <b>MIJOZ</b>\n\n` +
    `Ism:\n${escapeHtml(user.fullName || "—")}\n\n` +
    `Username:\n${usernameLine(user)}\n\n` +
    `Telegram ID:\n<code>${escapeHtml(String(user.telegramId || "—"))}</code>\n\n` +
    `Telefon:\n${escapeHtml(user.phone || "—")}\n\n` +
    `${DIV}\n\n` +
    `📍 <b>MANZIL</b>\n\n` +
    `${escapeHtml(order.address || "—")}\n\n` +
    `Latitude:\n<code>${order.latitude != null ? Number(order.latitude).toFixed(6) : "—"}</code>\n\n` +
    `Longitude:\n<code>${order.longitude != null ? Number(order.longitude).toFixed(6) : "—"}</code>\n\n` +
    `Google Maps:\n${
      order.latitude != null
        ? `<a href="${mapsLink(order.latitude, order.longitude)}">Ochish</a>`
        : "—"
    }\n\n` +
    `${DIV}\n\n` +
    `🎮 <b>KONSOL</b>\n\n` +
    `${escapeHtml(order.consoleType || inv.consoleType || "—")}\n\n` +
    `Inventory Unit\n<b>${escapeHtml(unitCode)}</b>\n\n` +
    `Serial\n<code>${escapeHtml(serial)}</code>\n\n` +
    `${DIV}\n\n` +
    `🎮 <b>JOYSTICKLAR</b>\n\n` +
    (js.length ? js.join("\n") : "—") +
    `\n\n${DIV}\n\n` +
    `📺 <b>HDMI</b>\n\n${escapeHtml(hdmi)}\n\n` +
    `${DIV}\n\n` +
    `🔌 <b>POWER</b>\n\n${escapeHtml(power)}\n\n` +
    `${DIV}\n\n` +
    `📄 <b>HUJJAT</b>\n\n${escapeHtml(collateral)}\n\n` +
    `${DIV}\n\n` +
    `💳 <b>TO'LOV</b>\n\n${escapeHtml(payment)}\n\n` +
    `${DIV}\n\n` +
    `💰 <b>SUMMA</b>\n\n` +
    `Ijara\n${moneyPlain(base)}\n\n` +
    `Yetkazish\n${moneyPlain(delivery)}\n\n` +
    `Jami\n<b>${moneyPlain(total)}</b>\n\n` +
    `${DIV}\n\n` +
    `📅 <b>Boshlanish</b>\n${escapeHtml(
      formatDatetime(order.rentalStartAt || meta.deliveredAt || order.startDatetime)
    )}\n\n` +
    `Tugashi\n${escapeHtml(
      formatDatetime(order.expectedReturnAt || order.endDatetime)
    )}\n\n` +
    `${DIV}\n\n` +
    `🚚 <b>KURYER</b>\n\n` +
    `${escapeHtml(courier.fullName || "—")}\n\n` +
    `Telegram ID:\n<code>${escapeHtml(String(courier.telegramId || "—"))}</code>\n\n` +
    `Username:\n${usernameLine(courier)}\n\n` +
    `${DIV}\n\n` +
    `👨‍💼 <b>ADMIN</b>\n\nKim tasdiqladi:\n${escapeHtml(resolveConfirmingAdmin(order))}\n\n` +
    `${DIV}\n\n` +
    `🕒 <b>Topshirilgan vaqt</b>\n${escapeHtml(
      formatDatetime(meta.deliveredAt || order.rentalStartAt || new Date())
    )}\n\n` +
    `${DIV}\n\n` +
    `<b>SYSTEM</b>\n\n` +
    `Order Status\nRENTED / ACTIVE\n\n` +
    `Console\nRENTED\n\n` +
    `Accessories\nRENTED`
  );
}

function formatReturnPickedUp(order) {
  const inv = buildInventorySummary(order);
  const pay = buildPaymentSummary(order);
  const user = order.user || {};
  const courier = order.courier || {};
  const js = inv.joysticks.map((j) => escapeHtml(j.code));
  const start = order.rentalStartAt || order.startDatetime;
  const end = order.pickedUpAt || order.returnedAt || new Date();
  let durationH = order.rentalPrice?.hours;
  if (durationH == null && start && end) {
    durationH = Math.max(1, Math.round((new Date(end) - new Date(start)) / 3600000));
  }
  const extHours = pay.extensionLines.reduce((s, e) => s + Number(e.extraHours || 0), 0);
  const tag = HASHTAG[AuditChannelEvent.RETURN_PICKED_UP];
  const unitStatus = displayInventoryStatus(order.inventoryUnit?.status || "RENTED");

  return (
    `${tag}\n\n` +
    `${DIV}\n\n` +
    `📦 <b>Buyurtma</b>\n\n#${order.id}\n\n` +
    `${DIV}\n\n` +
    `👤 <b>MIJOZ</b>\n\n` +
    `${escapeHtml(user.fullName || "—")}\n` +
    `${escapeHtml(user.phone || "—")}\n` +
    `${usernameLine(user)}\n\n` +
    `${DIV}\n\n` +
    `🎮 <b>KONSOL</b>\n\n${escapeHtml(inv.unitCode)}\n\n` +
    `${DIV}\n\n` +
    `🎮 <b>Joystick</b>\n\n` +
    (js.length ? js.join("\n") : "—") +
    `\n\n${DIV}\n\n` +
    `📺 <b>HDMI</b>\n\n${
      inv.hdmi.length ? inv.hdmi.map((h) => escapeHtml(h.code)).join("\n") : "—"
    }\n\n` +
    `${DIV}\n\n` +
    `🔌 <b>POWER</b>\n\n${
      inv.power.length ? inv.power.map((p) => escapeHtml(p.code)).join("\n") : "—"
    }\n\n` +
    `${DIV}\n\n` +
    `💰 <b>To'langan jami</b>\n\n${moneyPlain(pay.totalPaid)}\n\n` +
    `${DIV}\n\n` +
    `⏳ <b>Ijara davomiyligi</b>\n\n${durationH != null ? `${durationH} soat` : "—"}\n\n` +
    `${DIV}\n\n` +
    `➕ <b>Uzaytirish</b>\n\n` +
    (extHours > 0
      ? `${extHours} soat\nQo'shimcha:\n${moneyPlain(pay.extensionTotal)}`
      : "0") +
    `\n\n${DIV}\n\n` +
    `🚚 <b>Qaytarib olgan kuryer</b>\n\n` +
    `${escapeHtml(courier.fullName || "—")}\n` +
    `<code>${escapeHtml(String(courier.telegramId || "—"))}</code>\n\n` +
    `${DIV}\n\n` +
    `🕒 <b>Qaytarilgan vaqt</b>\n${escapeHtml(
      formatDatetime(order.pickedUpAt || order.returnedAt || new Date())
    )}\n\n` +
    `${DIV}\n\n` +
    `<b>SYSTEM</b>\n\n` +
    `Order Status\nPICKED_UP\n\n` +
    `Inventory\n${escapeHtml(unitStatus)}`
  );
}

/**
 * @param {object} order
 * @param {object} meta
 * @param {"ok"|"damaged"} meta.outcome
 * @param {string|null} meta.note
 * @param {number} [meta.fineAmount]
 * @param {Array<{label:string, ok:boolean, reason?:string}>} [meta.itemResults]
 */
function formatInspectionCompleted(order, meta = {}) {
  const inv = buildInventorySummary(order);
  const damaged = meta.outcome === "damaged" || meta.outcome === "maintenance";
  const fine = Number(meta.fineAmount || 0);
  const note = meta.note || (damaged ? "Nosozlik aniqlandi" : "Tekshiruv OK");
  const finalStatus = damaged ? "UNDER_REPAIR" : "AVAILABLE";
  const tag = HASHTAG[AuditChannelEvent.INSPECTION_COMPLETED];

  let itemLines;
  if (Array.isArray(meta.itemResults) && meta.itemResults.length) {
    itemLines = meta.itemResults
      .map((r) => {
        const mark = r.ok ? "✅" : "❌";
        const reason = !r.ok && r.reason ? ` ${escapeHtml(r.reason)}` : "";
        return `${escapeHtml(r.label)}\n${mark}${reason}`;
      })
      .join("\n\n");
  } else {
    const jsLines = inv.joysticks.map((j, i) => {
      if (!damaged) return `Joystick${i + 1}\n✅`;
      // On damaged: first joystick flagged with note if present
      if (i === 0) return `Joystick${i + 1}\n❌ ${escapeHtml(note)}`;
      return `Joystick${i + 1}\n✅`;
    });
    itemLines = [
      `Console\n${damaged ? "❌" : "✅"}`,
      ...jsLines,
      `HDMI\n✅`,
      `Power\n✅`,
    ].join("\n\n");
  }

  return (
    `${tag}\n\n` +
    `Order #${order.id}\n\n` +
    `<b>Natija</b>\n\n` +
    `${itemLines}\n\n` +
    `${DIV}\n\n` +
    `Jarima\n${moneyPlain(fine)}\n\n` +
    `Sabab\n${escapeHtml(damaged ? note : "—")}\n\n` +
    `${DIV}\n\n` +
    `Repair\n${damaged ? "YES" : "NO"}\n\n` +
    `${DIV}\n\n` +
    `Final Status\n<b>${finalStatus}</b>`
  );
}

function photoCaption(eventType, orderId, kind) {
  const tag = HASHTAG[eventType] || "";
  if (eventType === AuditChannelEvent.DELIVERY_COMPLETED) {
    return `${tag}\nOrder #${orderId}\nMijoz va ijara shartnomasi`;
  }
  if (eventType === AuditChannelEvent.RETURN_PICKED_UP) {
    return `${tag}\nOrder #${orderId}\nQaytarish rasmi`;
  }
  return `${tag}\nOrder #${orderId}\n${kind || "Audit photo"}`;
}

module.exports = {
  formatDeliveryCompleted,
  formatReturnPickedUp,
  formatInspectionCompleted,
  photoCaption,
  moneyPlain,
  DIV,
};
