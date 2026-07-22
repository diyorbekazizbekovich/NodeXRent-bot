/**
 * Order start reminders + confirmation-ready / priority notifications.
 *
 * User 3h/2h/1h reminders:
 *  - Fire ONLY in the exact reminder minute (start − N hours)
 *  - Missed minutes are claimed as skipped — never compensated after restart/late cron
 *  - Idempotent flags via OrderReminderLog unique (orderId, kind)
 */
const prisma = require("../config/prisma");
const env = require("../config/env");
const logger = require("../utils/logger");
const { notify } = require("./notification.service");
const { getAdminRecipients } = require("../utils/adminRecipients");
const { formatDatetime, formatDate, formatTime, TZ } = require("../utils/dateHelper");
const {
  ReminderKind,
  ReminderDecision,
  USER_REMINDER_HOURS,
  UNCONFIRMED_STATUSES,
  getHoursUntilStart,
  decideUserStartReminder,
  decideExactMinuteFire,
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
 * Atomically claim reminder slot (sent OR skipped). Returns false if already claimed.
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
    time: formatTime(d),
    full: formatDatetime(d),
  };
}

function logUserReminder(event, { hours, order, reminderAt, now, reason }) {
  const label = `${hours}h`;
  const payload = {
    context: "ReminderService",
    event,
    hours,
    orderId: order.id,
    userTelegramId: order.user?.telegramId?.toString?.() || null,
    reminderTime: reminderAt ? formatTime(reminderAt) : null,
    currentTime: formatTime(now),
    timezone: TZ,
    reminderAtIso: reminderAt?.toISOString?.() || null,
    nowIso: new Date(now).toISOString(),
  };
  if (reason) payload.reason = reason;

  if (event === "sent") {
    logger.info(`Reminder ${label} sent`, payload);
  } else if (event === "skipped") {
    logger.info(`Reminder ${label} skipped`, payload);
  } else {
    logger.info(`Reminder ${label} ${event}`, payload);
  }
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
 * User 3h / 2h / 1h start reminders — exact-minute fire, no catch-up.
 *
 * Example: start 06:00 → fire at 03:00 / 04:00 / 05:00 only.
 * If order created at 04:15: 3h+2h already passed → claim skipped; 1h waits for 05:00.
 */
async function processUserStartReminders(now = new Date()) {
  const maxH = Math.max(...USER_REMINDER_HOURS.map((r) => r.hours));
  const deadline = new Date(now.getTime() + maxH * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: {
        notIn: ["CANCELLED", "REJECTED", "COMPLETED", "RETURNED", "EXPIRED"],
      },
      // Include orders whose start is still ahead OR whose earliest reminder
      // minute might still need a SKIP claim (start within maxH).
      startDatetime: { lte: deadline, gt: now },
    },
    include: { user: true },
  });

  let sent = 0;
  let skipped = 0;

  for (const order of orders) {
    if (!order.user?.telegramId) continue;

    for (const { hours, kind } of USER_REMINDER_HOURS) {
      const decision = decideUserStartReminder(order.startDatetime, hours, now);

      if (decision.action === ReminderDecision.WAIT) continue;

      const claimed = await claimReminderSlot(order.id, kind, {
        hours,
        status: decision.action,
        reminderAt: decision.reminderAt?.toISOString?.() || null,
        reason: decision.reason || null,
        timezone: TZ,
      });
      if (!claimed) continue;

      if (decision.action === ReminderDecision.SKIP) {
        skipped += 1;
        logUserReminder("skipped", {
          hours,
          order,
          reminderAt: decision.reminderAt,
          now,
          reason: decision.reason,
        });
        continue;
      }

      // SEND
      await notify({
        orderId: order.id,
        type: "ORDER_START_REMINDER",
        recipientType: "user",
        recipientTelegramId: order.user.telegramId.toString(),
        recipientId: order.userId,
        text: buildUserStartReminderText(order, hours),
      });
      sent += 1;
      logUserReminder("sent", {
        hours,
        order,
        reminderAt: decision.reminderAt,
        now,
      });
    }
  }

  return { sent, skipped };
}

/**
 * Return-before-end reminder — exact minute only (no catch-up).
 */
async function processReturnReminders(now = new Date()) {
  const hoursBefore = env.RETURN_REMINDER_HOURS_BEFORE || 2;
  // Look ahead so we can claim SKIP for already-passed fire times within horizon
  const horizon = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["DELIVERED", "ACTIVE"] },
      endDatetime: { gt: now, lte: horizon },
    },
    include: { user: true },
  });

  let sent = 0;
  for (const order of orders) {
    if (!order.user?.telegramId || !order.endDatetime) continue;

    const fireAt = new Date(
      new Date(order.endDatetime).getTime() - hoursBefore * 60 * 60 * 1000
    );
    const decision = decideExactMinuteFire(fireAt, now);
    if (decision.action === ReminderDecision.WAIT) continue;

    const kind = `RETURN_BEFORE_END_${hoursBefore}H`;
    const claimed = await claimReminderSlot(order.id, kind, {
      hoursBefore,
      status: decision.action,
      reminderAt: decision.fireAt?.toISOString?.() || null,
      reason: decision.reason || null,
      timezone: TZ,
    });
    if (!claimed) continue;

    if (decision.action === ReminderDecision.SKIP) {
      logger.info(`Return reminder ${hoursBefore}h skipped`, {
        context: "ReminderService",
        orderId: order.id,
        reason: decision.reason,
        reminderTime: formatTime(decision.fireAt),
        currentTime: formatTime(now),
        timezone: TZ,
      });
      continue;
    }

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
    logger.info(`Return reminder ${hoursBefore}h sent`, {
      context: "ReminderService",
      orderId: order.id,
      userTelegramId: order.user.telegramId.toString(),
      reminderTime: formatTime(decision.fireAt),
      currentTime: formatTime(now),
      timezone: TZ,
    });
  }
  return sent;
}

async function processAllReminders(now = new Date()) {
  const confirmReady = await processConfirmReadyReminders(now);
  const priority = await processPriorityReminders(now);
  const userStartResult = await processUserStartReminders(now);
  const userStart = userStartResult.sent;
  const userStartSkipped = userStartResult.skipped;
  const returns = await processReturnReminders(now);

  const total = confirmReady + priority + userStart + returns;
  if (total > 0 || userStartSkipped > 0) {
    logger.info("Reminders processed", {
      context: "ReminderService",
      confirmReady,
      priority,
      userStart,
      userStartSkipped,
      returns,
    });
  }
  return {
    confirmReady,
    priority,
    userStart,
    userStartSkipped,
    returns,
    total,
  };
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
  ReminderDecision,
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
  decideUserStartReminder,
};
