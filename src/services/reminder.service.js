/**
 * Order start reminders + confirmation-ready / priority notifications.
 * Idempotent via OrderReminderLog unique (orderId, kind).
 */
const prisma = require("../config/prisma");
const env = require("../config/env");
const logger = require("../utils/logger");
const { notify } = require("./notification.service");
const { getAdminRecipients } = require("../utils/adminRecipients");
const { formatDatetime, formatDate } = require("../utils/dateHelper");
const {
  ReminderKind,
  USER_REMINDER_HOURS,
  UNCONFIRMED_STATUSES,
  getHoursUntilStart,
  isOrderConfirmed,
} = require("../constants/orderConfirmation");
const { canConfirmOrder, confirmWindowHours } = require("./orderConfirmation.service");
const adminOrderKeyboards = require("../bot/keyboards/admin.order.keyboards");
const courierKeyboards = require("../bot/keyboards/courier.keyboards");

async function wasReminderSent(orderId, kind) {
  const row = await prisma.orderReminderLog.findUnique({
    where: { orderId_kind: { orderId: Number(orderId), kind } },
  });
  return Boolean(row);
}

/**
 * Atomically claim reminder slot. Returns false if already sent (race-safe).
 */
async function claimReminderSlot(orderId, kind, meta = {}) {
  try {
    await prisma.orderReminderLog.create({
      data: {
        orderId: Number(orderId),
        kind,
        meta,
      },
    });
    return true;
  } catch (err) {
    if (err?.code === "P2002") return false;
    throw err;
  }
}

function formatStartParts(startDatetime) {
  const d = new Date(startDatetime);
  return {
    date: formatDate(d),
    time: d.toLocaleTimeString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Tashkent",
    }),
    full: formatDatetime(d),
  };
}

function buildUserStartReminderText(order, hoursLeft) {
  const { date, time } = formatStartParts(order.startDatetime);
  return (
    `🔔 <b>Eslatma</b>\n\n` +
    `Sizning PlayStation buyurtmangiz boshlanishiga <b>${hoursLeft} soat</b> qoldi.\n\n` +
    `Buyurtma vaqti:\n` +
    `<b>${date}</b>\n` +
    `<b>${time}</b>\n\n` +
    `Tayyor bo'ling.`
  );
}

function buildConfirmReadyText(order) {
  const { buildOrderDetailsText } = require("./orderNotification.service");
  return (
    `✅ <b>Tasdiqlash mumkin</b>\n\n` +
    `Buyurtma #${order.id} boshlanishiga ${confirmWindowHours()} soat yoki kamroq qoldi.\n` +
    `🕒 ${formatDatetime(order.startDatetime)}\n\n` +
    buildOrderDetailsText(order)
  );
}

function buildPriorityText(order) {
  const { buildOrderDetailsText } = require("./orderNotification.service");
  const hours = Math.max(0, Math.ceil(getHoursUntilStart(order.startDatetime)));
  return (
    `🚨 <b>HIGH PRIORITY</b>\n\n` +
    `Buyurtma #${order.id} hali tasdiqlanmagan!\n` +
    `Boshlanishiga ~${hours} soat qoldi.\n` +
    `🕒 ${formatDatetime(order.startDatetime)}\n\n` +
    buildOrderDetailsText(order)
  );
}

async function notifyAdmins(order, { type, text, options }) {
  const admins = await getAdminRecipients();
  for (const admin of admins) {
    await notify({
      orderId: order.id,
      type,
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text,
      options,
    });
  }
}

async function notifyAssignedOrAllCouriers(order, { type, text, withAcceptKeyboard }) {
  const courierRepo = require("../repositories/courier.repository");
  let couriers = [];
  if (order.courierId && order.courier) {
    couriers = [order.courier];
  } else if (order.courierId) {
    const c = await courierRepo.findById(order.courierId);
    if (c) couriers = [c];
  } else {
    couriers = await courierRepo.listActive();
  }

  for (const courier of couriers) {
    const options = withAcceptKeyboard
      ? courierKeyboards.newOrderKeyboard(order.id, order.latitude, order.longitude, {
          confirmAllowed: true,
        })
      : undefined;
    await notify({
      orderId: order.id,
      type,
      recipientType: "courier",
      recipientTelegramId: courier.telegramId.toString(),
      recipientId: courier.id,
      text,
      options,
    });
  }
}

/**
 * 6h window: unlock confirmation notifications (once).
 */
async function processConfirmReadyReminders(now = new Date()) {
  const windowH = confirmWindowHours();
  const deadline = new Date(now.getTime() + windowH * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...UNCONFIRMED_STATUSES] },
      startDatetime: { lte: deadline },
    },
    include: { user: true, courier: true, rentalPrice: true, inventoryUnit: true },
  });

  let sent = 0;
  for (const order of orders) {
    if (!canConfirmOrder(order, now)) continue;
    const claimed = await claimReminderSlot(order.id, ReminderKind.CONFIRM_READY_6H, {
      windowHours: windowH,
    });
    if (!claimed) continue;

    const text = buildConfirmReadyText(order);
    await notifyAdmins(order, {
      type: "ORDER_CONFIRM_READY",
      text,
      options: adminOrderKeyboards.newOrderKeyboard(order.id, { confirmAllowed: true }),
    });
    // Couriers are notified only after admin confirms (ADMIN_CONFIRMED)
    sent += 1;
  }
  return sent;
}

/**
 * 2h priority if still unconfirmed.
 */
async function processPriorityReminders(now = new Date()) {
  const priorityH = Number(env.ORDER_PRIORITY_REMINDER_HOURS) || 2;
  const deadline = new Date(now.getTime() + priorityH * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...UNCONFIRMED_STATUSES] },
      startDatetime: { lte: deadline },
    },
    include: { user: true, courier: true, rentalPrice: true, inventoryUnit: true },
  });

  let sent = 0;
  for (const order of orders) {
    if (isOrderConfirmed(order)) continue;
    if (getHoursUntilStart(order.startDatetime, now) > priorityH) continue;

    const claimed = await claimReminderSlot(order.id, ReminderKind.PRIORITY_2H, {
      priorityHours: priorityH,
    });
    if (!claimed) continue;

    await prisma.order.update({
      where: { id: order.id },
      data: { isHighPriority: true },
    });

    const text = buildPriorityText(order);
    await notifyAdmins(order, {
      type: "ORDER_PRIORITY_REMINDER",
      text,
      options: adminOrderKeyboards.newOrderKeyboard(order.id, { confirmAllowed: true, highPriority: true }),
    });
    // Priority is admin-only until confirm → courier fan-out
    sent += 1;
  }
  return sent;
}

/**
 * User 3h / 2h / 1h start reminders.
 */
async function processUserStartReminders(now = new Date()) {
  const maxH = 3;
  const deadline = new Date(now.getTime() + maxH * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: {
        notIn: ["CANCELLED", "REJECTED", "COMPLETED", "RETURNED", "EXPIRED"],
      },
      startDatetime: { lte: deadline, gt: now },
    },
    include: { user: true },
  });

  let sent = 0;
  for (const order of orders) {
    if (!order.user?.telegramId) continue;
    const hoursUntil = getHoursUntilStart(order.startDatetime, now);

    for (const { hours, kind } of USER_REMINDER_HOURS) {
      if (hoursUntil > hours) continue;
      const claimed = await claimReminderSlot(order.id, kind, { hours });
      if (!claimed) continue;

      await notify({
        orderId: order.id,
        type: "ORDER_START_REMINDER",
        recipientType: "user",
        recipientTelegramId: order.user.telegramId.toString(),
        recipientId: order.userId,
        text: buildUserStartReminderText(order, hours),
      });
      sent += 1;
    }
  }
  return sent;
}

/**
 * Existing return-before-end reminders (DELIVERED/ACTIVE).
 */
async function processReturnReminders(now = new Date()) {
  const hoursBefore = env.RETURN_REMINDER_HOURS_BEFORE || 2;
  const windowStart = new Date(now.getTime() + (hoursBefore * 60 - 5) * 60 * 1000);
  const windowEnd = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["DELIVERED", "ACTIVE"] },
      endDatetime: { gte: windowStart, lte: windowEnd },
    },
    include: { user: true },
  });

  let sent = 0;
  for (const order of orders) {
    const claimed = await claimReminderSlot(order.id, `RETURN_BEFORE_END_${hoursBefore}H`, {});
    if (!claimed) continue;

    const { t, resolveLang } = require("../i18n");
    const L = resolveLang(order.user?.language);
    await notify({
      orderId: order.id,
      type: "RETURN_REMINDER",
      recipientType: "user",
      recipientTelegramId: order.user.telegramId.toString(),
      recipientId: order.userId,
      text: t("notify.reminder", L, { id: order.id, hours: hoursBefore }),
    });
    sent += 1;
  }
  return sent;
}

async function processAllReminders(now = new Date()) {
  const confirmReady = await processConfirmReadyReminders(now);
  const priority = await processPriorityReminders(now);
  const userStart = await processUserStartReminders(now);
  const returns = await processReturnReminders(now);

  const total = confirmReady + priority + userStart + returns;
  if (total > 0) {
    logger.info("Reminders processed", {
      context: "ReminderService",
      confirmReady,
      priority,
      userStart,
      returns,
    });
  }
  return { confirmReady, priority, userStart, returns, total };
}

async function listUpcomingOrders({ take = 20 } = {}) {
  const now = new Date();
  return prisma.order.findMany({
    where: {
      status: { in: ["PENDING", "ADMIN_CONFIRMED", "COURIER_ASSIGNED", "ACCEPTED", "ON_THE_WAY"] },
      startDatetime: { gt: now },
    },
    orderBy: { startDatetime: "asc" },
    take,
    include: { user: true, courier: true },
  });
}

async function listReadyForConfirmation({ take = 20 } = {}) {
  const now = new Date();
  const deadline = new Date(now.getTime() + confirmWindowHours() * 60 * 60 * 1000);
  return prisma.order.findMany({
    where: {
      status: { in: [...UNCONFIRMED_STATUSES] },
      startDatetime: { lte: deadline },
    },
    orderBy: { startDatetime: "asc" },
    take,
    include: { user: true, courier: true },
  });
}

async function listHighPriorityOrders({ take = 20 } = {}) {
  return prisma.order.findMany({
    where: {
      OR: [
        { isHighPriority: true, status: { in: [...UNCONFIRMED_STATUSES] } },
        {
          status: { in: [...UNCONFIRMED_STATUSES] },
          startDatetime: {
            lte: new Date(Date.now() + (Number(env.ORDER_PRIORITY_REMINDER_HOURS) || 2) * 3600 * 1000),
          },
        },
      ],
    },
    orderBy: { startDatetime: "asc" },
    take,
    include: { user: true, courier: true },
  });
}

module.exports = {
  ReminderKind,
  wasReminderSent,
  claimReminderSlot,
  processAllReminders,
  processConfirmReadyReminders,
  processPriorityReminders,
  processUserStartReminders,
  processReturnReminders,
  listUpcomingOrders,
  listReadyForConfirmation,
  listHighPriorityOrders,
  buildUserStartReminderText,
};
