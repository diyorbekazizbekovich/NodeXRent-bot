/**
 * Early return requests — customer may request pickup before rental ends.
 * Order / Inventory / Accessories stay unchanged until admin approves.
 */
const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const auditLogService = require("./auditLog.service");
const rentalReturnService = require("./rentalReturn.service");
const {
  EarlyReturnReason,
  ReturnRequestStatus,
  labelReason,
} = require("../constants/earlyReturn");
const { OrderStatus } = require("../constants/orderStatus");
const { formatRemainingDuration, formatDatetime, addHours } = require("../utils/dateHelper");
const { notify } = require("./notification.service");
const { getAdminRecipients } = require("../utils/adminRecipients");
const { escapeHtml } = require("../utils/telegramFormat");
const earlyReturnKeyboards = require("../bot/keyboards/earlyReturn.keyboards");

class EarlyReturnError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "EarlyReturnError";
    this.code = code;
  }
}

const ACTIVE_ORDER_STATUSES = [OrderStatus.ACTIVE, OrderStatus.DELIVERED];

function assertReason(reason) {
  if (!Object.values(EarlyReturnReason).includes(reason)) {
    throw new EarlyReturnError("INVALID_REASON", "Sabab noto'g'ri");
  }
}

async function getById(id) {
  return prisma.returnRequest.findUnique({
    where: { id: Number(id) },
    include: {
      order: {
        include: {
          user: true,
          courier: true,
          inventoryUnit: true,
          rentalPrice: { include: { consoleCatalog: true } },
        },
      },
      customer: true,
      approvedByAdmin: true,
    },
  });
}

async function findPendingForOrder(orderId) {
  return prisma.returnRequest.findFirst({
    where: {
      orderId: Number(orderId),
      status: ReturnRequestStatus.PENDING_ADMIN,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Create PENDING_ADMIN request — does NOT touch Order status or inventory.
 */
async function createRequest({
  orderId,
  customerId,
  reason,
  customReason = null,
  pickupAddress,
  pickupLatitude = null,
  pickupLongitude = null,
  requestedPickupTime,
}) {
  assertReason(reason);
  if (reason === EarlyReturnReason.OTHER && !String(customReason || "").trim()) {
    throw new EarlyReturnError("CUSTOM_REASON", "Boshqa sabab matnini yozing");
  }
  if (!pickupAddress || !String(pickupAddress).trim()) {
    throw new EarlyReturnError("ADDRESS", "Manzil majburiy");
  }
  if (!requestedPickupTime) {
    throw new EarlyReturnError("TIME", "Olib ketish vaqti majburiy");
  }

  const order = await prisma.order.findUnique({
    where: { id: Number(orderId) },
    include: { user: true, inventoryUnit: true, courier: true },
  });
  if (!order) throw new EarlyReturnError("NOT_FOUND", "Buyurtma topilmadi");
  if (order.userId !== Number(customerId)) {
    throw new EarlyReturnError("FORBIDDEN", "Bu buyurtma sizniki emas");
  }
  if (!ACTIVE_ORDER_STATUSES.includes(order.status)) {
    throw new EarlyReturnError(
      "INVALID_STATUS",
      `Bu holatda erta qaytarish mumkin emas: ${order.status}`
    );
  }

  const existing = await findPendingForOrder(order.id);
  if (existing) {
    throw new EarlyReturnError(
      "DUPLICATE",
      `Bu buyurtma uchun allaqachon so'rov #${existing.id} kutilmoqda`
    );
  }

  const end = rentalReturnService.getExpectedReturnAt(order);
  const remaining = formatRemainingDuration(end);

  const created = await prisma.$transaction(async (tx) => {
    const req = await tx.returnRequest.create({
      data: {
        orderId: order.id,
        customerId: Number(customerId),
        reason,
        customReason:
          reason === EarlyReturnReason.OTHER ? String(customReason).trim() : null,
        pickupAddress: String(pickupAddress).trim(),
        pickupLatitude: pickupLatitude != null ? Number(pickupLatitude) : null,
        pickupLongitude: pickupLongitude != null ? Number(pickupLongitude) : null,
        requestedPickupTime: new Date(requestedPickupTime),
        remainingRentalTime: remaining,
        status: ReturnRequestStatus.PENDING_ADMIN,
      },
    });

    await auditLogService.log({
      module: "EARLY_RETURN",
      action: "EARLY_RETURN_REQUESTED",
      entityType: "ReturnRequest",
      entityId: req.id,
      afterData: {
        orderId: order.id,
        reason,
        remaining,
        requestedPickupTime: new Date(requestedPickupTime).toISOString(),
      },
    });

    return req;
  });

  const full = await getById(created.id);
  try {
    await notifyAdminsNewRequest(full);
  } catch (err) {
    logger.warn("Early return admin notify failed", { error: err.message });
  }

  return full;
}

function buildAdminCard(req) {
  const order = req.order;
  const user = req.customer || order?.user;
  const unit = order?.inventoryUnit?.unitCode || order?.consoleType || "—";
  const reasonText = labelReason(req.reason, req.customReason);
  const remaining =
    req.remainingRentalTime ||
    formatRemainingDuration(rentalReturnService.getExpectedReturnAt(order || {}));

  return (
    `🔔 <b>Muddatidan oldin qaytarish so'rovi</b>\n\n` +
    `👤 Mijoz: ${escapeHtml(user?.fullName || "—")}\n` +
    `🎮 Konsol: <b>${escapeHtml(unit)}</b>\n` +
    `📦 Buyurtma: #${order?.id || req.orderId}\n\n` +
    `⏳ Qolgan vaqt:\n${escapeHtml(remaining)}\n\n` +
    `📝 Sabab:\n${escapeHtml(reasonText)}\n\n` +
    `📍 Olib ketish manzili:\n${escapeHtml(req.pickupAddress)}\n\n` +
    `🕒 Olib ketish vaqti:\n${escapeHtml(formatDatetime(req.requestedPickupTime))}\n` +
    (req.adminNote ? `\n📌 Admin izoh: ${escapeHtml(req.adminNote)}\n` : "") +
    `\n🆔 So'rov: #${req.id}`
  );
}

async function notifyAdminsNewRequest(req) {
  const text = buildAdminCard(req);
  const admins = await getAdminRecipients();
  for (const a of admins) {
    await notify({
      orderId: req.orderId,
      type: "EARLY_RETURN_REQUEST",
      recipientType: "admin",
      recipientTelegramId: String(a.telegramId),
      recipientId: a.recipientId || 0,
      text,
      options: {
        parse_mode: "HTML",
        ...earlyReturnKeyboards.adminReviewKeyboard(req.id),
      },
    });
  }
}

/**
 * Admin approves → Order becomes RETURN_REQUESTED + courier task.
 * Inventory still unchanged until courier pickup / inspection.
 */
async function approveRequest(requestId, { adminId = null, adminTelegramId = null } = {}) {
  const req = await getById(requestId);
  if (!req) throw new EarlyReturnError("NOT_FOUND", "So'rov topilmadi");
  if (req.status !== ReturnRequestStatus.PENDING_ADMIN) {
    throw new EarlyReturnError("INVALID_STATUS", `So'rov holati: ${req.status}`);
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.returnRequest.updateMany({
      where: { id: req.id, status: ReturnRequestStatus.PENDING_ADMIN },
      data: {
        status: ReturnRequestStatus.APPROVED,
        approvedAt: new Date(),
        approvedByAdminId: adminId || null,
      },
    });
    if (updated.count !== 1) {
      throw new EarlyReturnError("INVALID_STATUS", "So'rov allaqachon ko'rib chiqilgan");
    }
  });

  // Order lifecycle starts only after approval
  await rentalReturnService.requestReturn(req.orderId, {
    actorType: "admin",
    actorId: adminTelegramId,
    force: true,
    adminContext: { adminId, telegramId: adminTelegramId },
    note: `Erta qaytarish #${req.id} tasdiqlandi — ${labelReason(req.reason, req.customReason)}`,
  });

  // Prefer existing delivery courier for return task
  if (req.order?.courierId) {
    try {
      await rentalReturnService.assignReturnCourier(req.orderId, req.order.courierId, {
        adminId,
        telegramId: adminTelegramId,
      });
    } catch (err) {
      logger.warn("Early return auto-assign courier failed", {
        orderId: req.orderId,
        error: err.message,
      });
    }
  }

  const fresh = await getById(requestId);
  try {
    if (fresh.customer?.telegramId) {
      await notify({
        orderId: fresh.orderId,
        type: "EARLY_RETURN_APPROVED",
        recipientType: "user",
        recipientTelegramId: String(fresh.customer.telegramId),
        recipientId: fresh.customerId,
        text:
          `✅ Erta qaytarish so'rovingiz tasdiqlandi.\n\n` +
          `📦 Buyurtma #${fresh.orderId}\n` +
          `🕒 Olib ketish: ${formatDatetime(fresh.requestedPickupTime)}\n` +
          `📍 ${fresh.pickupAddress}\n\n` +
          `Kuryer tez orada bog'lanadi.`,
      });
    }
    if (fresh.order?.courier?.telegramId) {
      await notify({
        orderId: fresh.orderId,
        type: "EARLY_RETURN_APPROVED",
        recipientType: "courier",
        recipientTelegramId: String(fresh.order.courier.telegramId),
        recipientId: fresh.order.courierId,
        text:
          `↩️ Erta qaytarish vazifasi\n\n` +
          `📦 #${fresh.orderId} — ${fresh.order.inventoryUnit?.unitCode || fresh.order.consoleType}\n` +
          `👤 ${fresh.customer?.fullName || "—"}\n` +
          `📞 ${fresh.customer?.phone || "—"}\n` +
          `📍 ${fresh.pickupAddress}\n` +
          `🕒 ${formatDatetime(fresh.requestedPickupTime)}\n` +
          `📝 ${labelReason(fresh.reason, fresh.customReason)}`,
      });
    }
  } catch (err) {
    logger.warn("Early return approve notify failed", { error: err.message });
  }

  await auditLogService.log({
    module: "EARLY_RETURN",
    action: "EARLY_RETURN_APPROVED",
    adminId,
    adminTelegramId,
    entityType: "ReturnRequest",
    entityId: requestId,
    afterData: { orderId: req.orderId, status: "APPROVED" },
  });

  return fresh;
}

async function rejectRequest(requestId, { adminId = null, adminTelegramId = null, note = null } = {}) {
  const req = await getById(requestId);
  if (!req) throw new EarlyReturnError("NOT_FOUND", "So'rov topilmadi");
  if (req.status !== ReturnRequestStatus.PENDING_ADMIN) {
    throw new EarlyReturnError("INVALID_STATUS", `So'rov holati: ${req.status}`);
  }

  await prisma.returnRequest.update({
    where: { id: req.id },
    data: {
      status: ReturnRequestStatus.REJECTED,
      rejectedAt: new Date(),
      approvedByAdminId: adminId || null,
      adminNote: note || null,
    },
  });

  // Order stays ACTIVE / DELIVERED — no inventory change
  try {
    if (req.customer?.telegramId || req.order?.user?.telegramId) {
      const tg = req.customer?.telegramId || req.order.user.telegramId;
      await notify({
        orderId: req.orderId,
        type: "EARLY_RETURN_REJECTED",
        recipientType: "user",
        recipientTelegramId: String(tg),
        recipientId: req.customerId,
        text:
          `❌ Erta qaytarish so'rovingiz rad etildi.\n\n` +
          `📦 Buyurtma #${req.orderId}\n` +
          `Ijara faol qoladi — muddat tugaguncha foydalanishingiz mumkin.\n` +
          (note ? `\nIzoh: ${note}` : ""),
      });
    }
  } catch (err) {
    logger.warn("Early return reject notify failed", { error: err.message });
  }

  await auditLogService.log({
    module: "EARLY_RETURN",
    action: "EARLY_RETURN_REJECTED",
    adminId,
    adminTelegramId,
    entityType: "ReturnRequest",
    entityId: requestId,
    afterData: { orderId: req.orderId, status: "REJECTED" },
  });

  return getById(requestId);
}

/**
 * Admin proposes a different pickup time — request stays PENDING_ADMIN.
 */
async function reschedulePickup(requestId, newPickupTime, { adminId = null, adminTelegramId = null } = {}) {
  const req = await getById(requestId);
  if (!req) throw new EarlyReturnError("NOT_FOUND", "So'rov topilmadi");
  if (req.status !== ReturnRequestStatus.PENDING_ADMIN) {
    throw new EarlyReturnError("INVALID_STATUS", `So'rov holati: ${req.status}`);
  }
  const when = new Date(newPickupTime);
  if (!Number.isFinite(when.getTime())) {
    throw new EarlyReturnError("TIME", "Vaqt noto'g'ri");
  }

  await prisma.returnRequest.update({
    where: { id: req.id },
    data: {
      requestedPickupTime: when,
      adminNote: `Admin yangi vaqt taklif qildi: ${formatDatetime(when)}`,
      updatedAt: new Date(),
    },
  });

  const fresh = await getById(requestId);
  try {
    const tg = fresh.customer?.telegramId;
    if (tg) {
      await notify({
        orderId: fresh.orderId,
        type: "EARLY_RETURN_REQUEST",
        recipientType: "user",
        recipientTelegramId: String(tg),
        recipientId: fresh.customerId,
        text:
          `🕒 Erta qaytarish — yangi olib ketish vaqti taklif qilindi\n\n` +
          `📦 Buyurtma #${fresh.orderId}\n` +
          `Yangi vaqt: <b>${escapeHtml(formatDatetime(when))}</b>\n\n` +
          `Admin tasdiqlashini kuting yoki qo'llab-quvvatlashga yozing.`,
        options: { parse_mode: "HTML" },
      });
    }
    // Refresh admin cards
    await notifyAdminsNewRequest(fresh);
  } catch (err) {
    logger.warn("Early return reschedule notify failed", { error: err.message });
  }

  await auditLogService.log({
    module: "EARLY_RETURN",
    action: "EARLY_RETURN_RESCHEDULED",
    adminId,
    adminTelegramId,
    entityType: "ReturnRequest",
    entityId: requestId,
    afterData: { requestedPickupTime: when.toISOString() },
  });

  return fresh;
}

function resolvePickupTime(preset, now = new Date()) {
  if (preset === "now") return now;
  if (preset === "30m") return addHours(now, 0.5);
  if (preset === "1h") return addHours(now, 1);
  return null;
}

/** Parse KK.OO.YYYY SS:DD or KK.OO.YYYY SS */
function parseCustomPickupTime(text) {
  const t = String(text || "").trim();
  const m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const h = Number(m[4]);
  const mi = m[5] != null ? Number(m[5]) : 0;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const { zonedDateTime } = require("../utils/dateHelper");
  return zonedDateTime(y, mo, d, h, mi, 0);
}

module.exports = {
  EarlyReturnError,
  createRequest,
  getById,
  findPendingForOrder,
  approveRequest,
  rejectRequest,
  reschedulePickup,
  buildAdminCard,
  notifyAdminsNewRequest,
  resolvePickupTime,
  parseCustomPickupTime,
  ACTIVE_ORDER_STATUSES,
};
