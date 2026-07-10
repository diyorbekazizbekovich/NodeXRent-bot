const prisma = require("../config/prisma");
const pricingService = require("./pricing.service");
const paymentService = require("./payment.service");
const auditLogService = require("./auditLog.service");
const { notify } = require("./notification.service");
const { getAdminRecipients } = require("../utils/adminRecipients");
const { addHours, formatDatetime } = require("../utils/dateHelper");
const { ACTIVE_RENTAL_STATUSES } = require("../constants/orderStatus");

const ALLOWED_EXTEND_HOURS = [24, 48, 72];

function throwI18n(messageKey, fallback) {
  const err = new Error(fallback);
  err.messageKey = messageKey;
  throw err;
}

async function requestExtension(orderId, userId, extraHours, lang) {
  const hours = Number(extraHours);
  if (!ALLOWED_EXTEND_HOURS.includes(hours)) {
    throwI18n("extendErrors.badHours", "Faqat 1/2/3 kun (24/48/72 soat) uzaytirish mumkin");
  }

  const order = await prisma.order.findFirst({
    where: { id: Number(orderId), userId: Number(userId) },
    include: { user: true, rentalPrice: true, courier: true },
  });
  if (!order) throwI18n("extendErrors.notFound", "Buyurtma topilmadi");

  if (!ACTIVE_RENTAL_STATUSES.includes(order.status)) {
    throwI18n(
      "extendErrors.notActive",
      "Faqat faol ijara (yetkazilgan) uzaytirilishi mumkin. Tugagan yoki bekor qilingan buyurtmani uzaytirib bo'lmaydi."
    );
  }

  if (new Date(order.endDatetime).getTime() <= Date.now()) {
    throwI18n("extendErrors.ended", "Ijara muddati allaqachon tugagan — uzaytirib bo'lmaydi");
  }

  const existing = await prisma.rentalExtension.findFirst({
    where: { orderId: order.id, status: "PENDING" },
  });
  if (existing) {
    throwI18n(
      "extendErrors.pendingExists",
      "Kutilayotgan uzaytirish so'rovi allaqachon mavjud. Admin javobini kuting."
    );
  }

  const priceInfo = await pricingService.getRentalPrice(order.consoleType, hours);
  const extraPrice = pricingService.calculateTotalPrice(priceInfo.price, null);
  const newEnd = addHours(order.endDatetime, hours);

  const extension = await prisma.rentalExtension.create({
    data: {
      orderId: order.id,
      extraHours: hours,
      extraPrice,
      previousEnd: order.endDatetime,
      newEnd,
    },
  });

  const admins = await getAdminRecipients();
  const text =
    `⏳ <b>Ijara uzaytirish so'rovi</b>\n\n` +
    `Buyurtma: #${order.id}\n` +
    `Mijoz: ${order.user.fullName || "—"}\n` +
    `Konsol: ${order.consoleType}\n` +
    `Qo'shimcha: ${pricingService.formatDurationLabel(hours)}\n` +
    `Narx: ${extraPrice.toLocaleString()} so'm\n` +
    `Hozirgi tugash: ${formatDatetime(order.endDatetime)}\n` +
    `Yangi tugash: ${formatDatetime(newEnd)}`;

  for (const admin of admins) {
    await notify({
      orderId: order.id,
      type: "ORDER_CREATED",
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text,
      options: {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Tasdiqlash", callback_data: `admin:ext:approve:${extension.id}` },
              { text: "❌ Rad etish", callback_data: `admin:ext:reject:${extension.id}` },
            ],
          ],
        },
      },
    });
  }

  return {
    extension,
    order,
    extraPrice,
    newEnd,
    hours,
  };
}

async function approveExtension(extensionId, adminContext = {}) {
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.rentalExtension.findUnique({
      where: { id: Number(extensionId) },
      include: { order: { include: { user: true, courier: true } } },
    });
    if (!locked) throw new Error("So'rov topilmadi");
    if (locked.status !== "PENDING") {
      throw new Error(locked.status === "APPROVED" ? "Allaqachon tasdiqlangan" : "So'rov rad etilgan yoki yopilgan");
    }
    if (!ACTIVE_RENTAL_STATUSES.includes(locked.order.status)) {
      throw new Error("Buyurtma endi faol emas — uzaytirib bo'lmaydi");
    }

    const updated = await tx.rentalExtension.updateMany({
      where: { id: locked.id, status: "PENDING" },
      data: {
        status: "APPROVED",
        resolvedAt: new Date(),
        resolvedByAdminId: adminContext.adminId ?? null,
      },
    });
    if (updated.count === 0) throw new Error("So'rov allaqachon qayta ishlangan (duplicate)");

    const order = await tx.order.update({
      where: { id: locked.orderId },
      data: {
        endDatetime: locked.newEnd,
        totalPrice: { increment: locked.extraPrice },
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: locked.orderId,
        status: order.status,
        actorType: "admin",
        actorId: adminContext.adminId != null && adminContext.adminId <= 2147483647 ? adminContext.adminId : null,
        note: `Ijara ${locked.extraHours} soatga uzaytirildi (+${Number(locked.extraPrice)} so'm). Yangi tugash: ${formatDatetime(locked.newEnd)}`,
      },
    });

    return { locked, order };
  });

  try {
    await paymentService.initOrderPayment({
      id: result.locked.orderId,
      totalPrice: result.locked.extraPrice,
      deliveryFee: 0,
    });
  } catch (_) {}

  await auditLogService.log({
    module: "RENTAL",
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "RENTAL_EXTENSION_APPROVED",
    entityType: "RentalExtension",
    entityId: extensionId,
    afterData: {
      orderId: result.locked.orderId,
      extraHours: result.locked.extraHours,
      extraPrice: Number(result.locked.extraPrice),
    },
  });

  const { t, resolveLang } = require("../i18n");
  const userLang = resolveLang(result.locked.order.user?.language);
  await notify({
    orderId: result.locked.orderId,
    type: "ORDER_ACCEPTED",
    recipientType: "user",
    recipientTelegramId: result.locked.order.user.telegramId.toString(),
    recipientId: result.locked.order.userId,
    text: t("notify.extApproved", userLang, {
      id: result.locked.orderId,
      duration: pricingService.formatDurationLabel(result.locked.extraHours, userLang),
      newEnd: formatDatetime(result.locked.newEnd),
      price: pricingService.formatMoney(result.locked.extraPrice, "UZS", userLang),
    }),
    options: { parse_mode: "HTML" },
  });

  if (result.locked.order.courier?.telegramId) {
    await notify({
      orderId: result.locked.orderId,
      type: "ORDER_ACCEPTED",
      recipientType: "courier",
      recipientTelegramId: result.locked.order.courier.telegramId.toString(),
      recipientId: result.locked.order.courierId,
      text:
        `⏳ Buyurtma #${result.locked.orderId} uzaytirildi.\n` +
        `Yangi tugash: ${formatDatetime(result.locked.newEnd)}`,
    });
  }

  return result.locked;
}

async function rejectExtension(extensionId, adminContext = {}) {
  const existing = await prisma.rentalExtension.findUnique({ where: { id: Number(extensionId) } });
  if (!existing) throw new Error("So'rov topilmadi");
  if (existing.status !== "PENDING") throw new Error("So'rov allaqachon qayta ishlangan");

  const ext = await prisma.rentalExtension.update({
    where: { id: Number(extensionId) },
    data: {
      status: "REJECTED",
      resolvedAt: new Date(),
      resolvedByAdminId: adminContext.adminId ?? null,
    },
    include: { order: { include: { user: true } } },
  });

  const { t, resolveLang } = require("../i18n");
  const userLang = resolveLang(ext.order.user?.language);
  await notify({
    orderId: ext.orderId,
    type: "ORDER_REJECTED",
    recipientType: "user",
    recipientTelegramId: ext.order.user.telegramId.toString(),
    recipientId: ext.order.userId,
    text: t("notify.extRejected", userLang, { id: ext.orderId }),
  });

  return ext;
}

module.exports = {
  requestExtension,
  approveExtension,
  rejectExtension,
  ALLOWED_EXTEND_HOURS,
};
