/**
 * Admin inspection reminder — reusable for initial PICKED_UP notify + courier resend.
 *
 * Flow:
 *  1) Validate order/unit eligibility
 *  2) Claim cooldown slot in DB (atomic)
 *  3) AFTER DB update → notify ALL admins via NotificationService
 *  4) Audit INSPECTION_REMINDER_SENT
 */
const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const { notify } = require("./notification.service");
const { getAdminRecipients } = require("../utils/adminRecipients");
const { escapeHtml } = require("../utils/telegramFormat");
const { formatDatetime } = require("../utils/dateHelper");
const { money, buildPaymentSummary } = require("./orderSummary/paymentSummary.service");
const { buildInventorySummary } = require("./orderSummary/inventorySummary.service");
const adminOrderKeyboards = require("../bot/keyboards/admin.order.keyboards");
const { OrderStatus } = require("../constants/orderStatus");
const { AssetStatus } = require("../constants/inventoryAsset");
const { AuditAction } = require("../constants/auditActions");
const rentalReturnService = require("./rentalReturn.service");

const COOLDOWN_MS = 5 * 60 * 1000;

class InspectionReminderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "InspectionReminderError";
    this.code = code;
  }
}

const DETAIL_INCLUDE = {
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
  statusLogs: { orderBy: { changedAt: "desc" }, take: 30 },
};

async function loadOrder(orderId) {
  return prisma.order.findUnique({
    where: { id: Number(orderId) },
    include: DETAIL_INCLUDE,
  });
}

/**
 * Resolve responsible admin name if inspection was started (actor on status log).
 */
async function resolveResponsibleAdmin(order) {
  const startLog = (order.statusLogs || []).find(
    (l) =>
      l.actorType === "admin" &&
      (String(l.note || "").includes("Inspection started") ||
        String(l.note || "").includes("tekshiruv"))
  );
  if (!startLog?.actorId) return null;
  const admin = await prisma.admin.findUnique({
    where: { id: startLog.actorId },
    select: { id: true, fullName: true },
  });
  if (!admin) return null;
  return admin.fullName || `Admin #${admin.id}`;
}

function assertEligibleForReminder(order) {
  const unitStatus = order.inventoryUnit?.status || null;

  if (
    order.status === OrderStatus.COMPLETED ||
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.REJECTED
  ) {
    throw new InspectionReminderError(
      "ALREADY_DONE",
      "❌ Ushbu buyurtma uchun tekshiruv allaqachon yakunlangan."
    );
  }

  if (
    unitStatus === AssetStatus.AVAILABLE ||
    unitStatus === AssetStatus.MAINTENANCE ||
    unitStatus === AssetStatus.DISABLED
  ) {
    throw new InspectionReminderError(
      "ALREADY_DONE",
      "❌ Ushbu buyurtma uchun tekshiruv allaqachon yakunlangan."
    );
  }

  if (order.status !== OrderStatus.PICKED_UP) {
    throw new InspectionReminderError(
      "INVALID_STATUS",
      `❌ Tekshiruv eslatmasi faqat PICKED_UP uchun. Hozir: ${order.status}`
    );
  }

  // Waiting for admin: unit still RENTED, or already under INSPECTION
  if (
    unitStatus &&
    unitStatus !== AssetStatus.RENTED &&
    unitStatus !== AssetStatus.INSPECTION
  ) {
    throw new InspectionReminderError(
      "INVALID_UNIT",
      `❌ Inventar holati eslatma uchun mos emas: ${unitStatus}`
    );
  }
}

/**
 * Admin-facing reminder card (Uzbek).
 * @param {"initial"|"reminder"} kind
 */
function buildInspectionAdminText(order, kind = "reminder") {
  const inv = buildInventorySummary(order);
  const pay = buildPaymentSummary(order);
  const jsCount = inv.joysticks.length || 0;
  const jsLines =
    jsCount > 0
      ? inv.joysticks.map((j) => `• ${escapeHtml(j.code)}`).join("\n")
      : "• —";
  const title =
    kind === "initial"
      ? "🔔 <b>Qurilma qaytarildi</b>"
      : "🔔 <b>TEKSHIRUV ESLATMASI</b>";

  return (
    `${title}\n\n` +
    `📦 Buyurtma #${order.id}\n\n` +
    `🎮 Konsol\n<b>${escapeHtml(inv.unitCode)}</b>\n\n` +
    `👤 Mijoz: ${escapeHtml(order.user?.fullName || "—")}\n` +
    `🚚 Kuryer: ${escapeHtml(order.courier?.fullName || "—")}\n\n` +
    `📅 Ijaraga berilgan: ${escapeHtml(
      formatDatetime(order.rentalStartAt || order.startDatetime)
    )}\n` +
    `📅 Qaytarilgan: ${escapeHtml(
      formatDatetime(order.pickedUpAt || order.returnedAt)
    )}\n` +
    `📍 Manzil: ${escapeHtml(order.address || "—")}\n` +
    `💰 Umumiy to'lov: ${money(pay.totalPaid)}\n\n` +
    `📦 Inventory\n` +
    `🎮 Konsol: ${escapeHtml(inv.unitCode)}\n` +
    `🎮 Joystick (${jsCount}):\n${jsLines}\n` +
    `📺 HDMI: ${
      inv.hdmi.length ? inv.hdmi.map((h) => escapeHtml(h.code)).join(", ") : "—"
    }\n` +
    `🔌 Power: ${
      inv.power.length ? inv.power.map((p) => escapeHtml(p.code)).join(", ") : "—"
    }\n\n` +
    `⏳ Holat\n` +
    `Courier returned the device.\n` +
    `Waiting for admin inspection.\n` +
    `Unit: <b>${escapeHtml(order.inventoryUnit?.status || "RENTED")}</b>`
  );
}

async function notifyAllAdmins(order, kind) {
  const admins = await getAdminRecipients();
  if (!admins.length) {
    logger.error("Inspection reminder: no admin recipients", {
      context: "InspectionReminder",
      orderId: order.id,
    });
    return { sent: 0, failed: 0, empty: true };
  }

  const text = buildInspectionAdminText(order, kind);
  const options = {
    parse_mode: "HTML",
    ...adminOrderKeyboards.pickedUpInspectionKeyboard(order.id),
  };

  let sent = 0;
  let failed = 0;
  for (const admin of admins) {
    try {
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
    } catch (err) {
      failed += 1;
      logger.warn("Inspection reminder admin send failed — continuing", {
        context: "InspectionReminder",
        orderId: order.id,
        adminTelegramId: admin.telegramId,
        error: err.message,
      });
    }
  }
  return { sent, failed, empty: false };
}

/**
 * Atomically claim reminder slot (5 min cooldown).
 * @returns {{ claimed: boolean, lastAt: Date|null }}
 */
async function claimReminderSlot(orderId, { skipCooldown = false } = {}) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - COOLDOWN_MS);

  if (skipCooldown) {
    await prisma.order.update({
      where: { id: Number(orderId) },
      data: { lastInspectionReminderAt: now },
    });
    return { claimed: true, lastAt: now };
  }

  const updated = await prisma.order.updateMany({
    where: {
      id: Number(orderId),
      status: OrderStatus.PICKED_UP,
      OR: [
        { lastInspectionReminderAt: null },
        { lastInspectionReminderAt: { lte: cutoff } },
      ],
    },
    data: { lastInspectionReminderAt: now },
  });

  if (updated.count > 0) {
    return { claimed: true, lastAt: now };
  }

  const row = await prisma.order.findUnique({
    where: { id: Number(orderId) },
    select: { lastInspectionReminderAt: true },
  });
  return { claimed: false, lastAt: row?.lastInspectionReminderAt || null };
}

/**
 * @param {number|string} orderId
 * @param {object} [opts]
 * @param {"initial"|"reminder"} [opts.kind]
 * @param {boolean} [opts.skipCooldown] — true for first post-pickup notify
 * @param {string} [opts.actorType]
 * @param {number|null} [opts.actorId]
 */
async function sendInspectionReminder(orderId, opts = {}) {
  const {
    kind = "reminder",
    skipCooldown = false,
    actorType = "system",
    actorId = null,
  } = opts;

  const order = await loadOrder(orderId);
  if (!order) {
    throw new InspectionReminderError("NOT_FOUND", "Buyurtma topilmadi.");
  }

  assertEligibleForReminder(order);

  const slot = await claimReminderSlot(order.id, { skipCooldown });
  if (!slot.claimed) {
    throw new InspectionReminderError(
      "COOLDOWN",
      "⏳ Tekshiruv eslatmasi yaqinda yuborilgan.\nIltimos biroz kuting."
    );
  }

  // AFTER successful DB claim — notify admins
  const result = await notifyAllAdmins(order, kind);

  await rentalReturnService.logRentalAudit({
    action: AuditAction.INSPECTION_REMINDER_SENT,
    orderId: order.id,
    inventoryUnitId: order.inventoryUnitId,
    actorType,
    actorId,
    extra: {
      kind,
      sent: result.sent,
      failed: result.failed,
      lastInspectionReminderAt: slot.lastAt?.toISOString?.() || null,
    },
  });

  logger.info("INSPECTION_REMINDER_SENT", {
    context: "InspectionReminder",
    event: "INSPECTION_REMINDER_SENT",
    orderId: order.id,
    kind,
    actorType,
    actorId,
    sent: result.sent,
    failed: result.failed,
  });

  return {
    order,
    ...result,
    lastInspectionReminderAt: slot.lastAt,
  };
}

/**
 * Courier-facing status panel while waiting for admin inspection.
 */
async function buildCourierInspectionStatusCard(orderId) {
  const order = await loadOrder(orderId);
  if (!order) return null;

  const waitingSince = order.pickedUpAt || order.returnedAt;

  const elapsed = (() => {
    if (!waitingSince) return "—";
    const ms = Date.now() - new Date(waitingSince).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "—";
    const totalMinutes = Math.floor(ms / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days > 0) parts.push(`${days} kun`);
    if (hours > 0) parts.push(`${hours} soat`);
    if (days === 0 && (minutes > 0 || parts.length === 0)) parts.push(`${minutes} daqiqa`);
    return parts.join(" ");
  })();

  const responsible = await resolveResponsibleAdmin(order);
  const lastAt = order.lastInspectionReminderAt;

  return {
    order,
    text:
      `📦 <b>Buyurtma #${order.id}</b>\n\n` +
      `📌 Holat:\nKuryer qurilmani olib oldi\n\n` +
      `⏳ Tekshiruv kutilmoqda:\n<b>${escapeHtml(elapsed)}</b>\n\n` +
      `👤 Mas'ul admin:\n${escapeHtml(responsible || "Biriktirilmagan")}\n\n` +
      `🕒 Oxirgi eslatma:\n${escapeHtml(lastAt ? formatDatetime(lastAt) : "Hali yuborilmagan")}\n` +
      `\n━━━━━━━━━━━━━━`,
    elapsed,
    responsible,
    lastReminderAt: lastAt,
  };
}

module.exports = {
  InspectionReminderError,
  COOLDOWN_MS,
  sendInspectionReminder,
  buildInspectionAdminText,
  buildCourierInspectionStatusCard,
  loadOrder,
  assertEligibleForReminder,
};
