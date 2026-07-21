/**
 * Post-commit handler: ORDER_PICKED_UP → notify all admins + inspection CTA.
 * Failures are logged + retried; they never affect the committed pickup.
 */
const logger = require("../../utils/logger");
const { notify } = require("../../services/notification.service");
const { getAdminRecipients } = require("../../utils/adminRecipients");
const { escapeHtml } = require("../../utils/telegramFormat");
const { formatDatetime } = require("../../utils/dateHelper");
const { money } = require("../../services/orderSummary/paymentSummary.service");
const { buildPaymentSummary } = require("../../services/orderSummary/paymentSummary.service");
const { buildInventorySummary } = require("../../services/orderSummary/inventorySummary.service");
const adminOrderKeyboards = require("../../bot/keyboards/admin.order.keyboards");
const prisma = require("../../config/prisma");
const { DomainEvents, on } = require("../domainBus");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadOrderForPickupNotify(orderId) {
  return prisma.order.findUnique({
    where: { id: Number(orderId) },
    include: {
      user: true,
      courier: true,
      inventoryUnit: true,
      consoleItem: true,
      hdmiItem: true,
      powerItem: true,
      rentalPrice: true,
      payments: true,
      extensions: true,
      promocode: true,
      orderItems: { include: { inventoryItem: true } },
      photos: true,
    },
  });
}

function buildAdminPickupText(order) {
  const inv = buildInventorySummary(order);
  const pay = buildPaymentSummary(order);
  const js =
    inv.joysticks.length > 0
      ? inv.joysticks.map((j) => `• ${escapeHtml(j.code)}`).join("\n")
      : "• —";
  const returnPhotos = (order.photos || []).filter((p) => p.photoType === "RETURN");

  return (
    `🔔 <b>Qurilma qaytarildi</b>\n\n` +
    `📦 Buyurtma #${order.id}\n` +
    `📌 Status: <b>PICKED_UP</b>\n\n` +
    `👤 ${escapeHtml(order.user?.fullName || "—")}\n` +
    `📞 ${escapeHtml(order.user?.phone || "—")}\n\n` +
    `🎮 Console: <b>${escapeHtml(inv.unitCode)}</b>\n` +
    `🔢 Serial: ${escapeHtml(inv.serialNumber || "—")}\n\n` +
    `📦 Inventory\n` +
    `🕹 Joystick:\n${js}\n` +
    `📺 HDMI: ${
      inv.hdmi.length ? inv.hdmi.map((h) => escapeHtml(h.code)).join(", ") : "—"
    }\n` +
    `🔌 Power: ${
      inv.power.length ? inv.power.map((p) => escapeHtml(p.code)).join(", ") : "—"
    }\n\n` +
    `📅 Rental start: ${escapeHtml(formatDatetime(order.rentalStartAt || order.startDatetime))}\n` +
    `📅 Returned at: ${escapeHtml(formatDatetime(order.pickedUpAt || order.returnedAt))}\n` +
    `💰 Total paid: ${money(pay.totalPaid)}\n` +
    `📸 Return photos: ${returnPhotos.length}\n\n` +
    `🚚 Courier: ${escapeHtml(order.courier?.fullName || "—")}\n` +
    `🆔 Courier ID: #${order.courierId || "—"}`
  );
}

async function notifyAdminsOnce(order) {
  const admins = await getAdminRecipients();
  if (!admins.length) {
    logger.error("ADMIN_NOTIFICATION_FAILED — no admin recipients", {
      context: "OrderPickedUpHandler",
      orderId: order.id,
      event: "ADMIN_NOTIFICATION_FAILED",
    });
    return { sent: 0, failed: 0, empty: true };
  }

  const text = buildAdminPickupText(order);
  const options = {
    parse_mode: "HTML",
    ...adminOrderKeyboards.pickedUpInspectionKeyboard(order.id),
  };

  let sent = 0;
  let failed = 0;
  for (const admin of admins) {
    const ok = await notify({
      orderId: order.id,
      type: "ORDER_RETURNED",
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text,
      options,
    });
    if (ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed, empty: false };
}

async function handleOrderPickedUp({ orderId }) {
  logger.info("ADMIN_NOTIFICATION_STARTED", {
    context: "OrderPickedUpHandler",
    event: "ADMIN_NOTIFICATION_STARTED",
    orderId,
  });

  const order = await loadOrderForPickupNotify(orderId);
  if (!order) {
    logger.error("ADMIN_NOTIFICATION_FAILED — order missing", {
      context: "OrderPickedUpHandler",
      orderId,
    });
    return;
  }

  let last = { sent: 0, failed: 0 };
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    last = await notifyAdminsOnce(order);
    if (last.empty) return;
    if (last.failed === 0 && last.sent > 0) {
      logger.info("ADMIN_NOTIFICATION_SENT", {
        context: "OrderPickedUpHandler",
        event: "ADMIN_NOTIFICATION_SENT",
        orderId,
        sent: last.sent,
        attempt,
      });
      return;
    }
    logger.warn("ADMIN_NOTIFICATION_RETRY", {
      context: "OrderPickedUpHandler",
      orderId,
      attempt,
      sent: last.sent,
      failed: last.failed,
    });
    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
  }

  logger.error("ADMIN_NOTIFICATION_FAILED", {
    context: "OrderPickedUpHandler",
    event: "ADMIN_NOTIFICATION_FAILED",
    orderId,
    sent: last.sent,
    failed: last.failed,
  });
}

function registerOrderPickedUpHandler() {
  on(DomainEvents.ORDER_PICKED_UP, handleOrderPickedUp);
}

module.exports = {
  registerOrderPickedUpHandler,
  handleOrderPickedUp,
  buildAdminPickupText,
};
