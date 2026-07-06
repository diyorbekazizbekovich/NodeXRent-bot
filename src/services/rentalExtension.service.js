const prisma = require("../config/prisma");
const pricingService = require("./pricing.service");
const paymentService = require("./payment.service");
const auditLogService = require("./auditLog.service");
const { notify } = require("./notification.service");
const { getAdminRecipients } = require("../utils/adminRecipients");
const { addHours, formatDatetime } = require("../utils/dateHelper");
const { ACTIVE_RENTAL_STATUSES } = require("../constants/orderStatus");

async function requestExtension(orderId, userId, extraHours) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId, status: { in: ACTIVE_RENTAL_STATUSES } },
    include: { user: true, rentalPrice: true },
  });
  if (!order) throw new Error("Faol buyurtma topilmadi yoki uzaytirish mumkin emas");

  const hours = Number(extraHours);
  if (!Number.isInteger(hours) || hours <= 0) throw new Error("Noto'g'ri muddat");

  const priceInfo = await pricingService.getRentalPrice(order.consoleType, hours);
  const extraPrice = pricingService.calculateTotalPrice(priceInfo.price, null);

  const existing = await prisma.rentalExtension.findFirst({
    where: { orderId, status: "PENDING" },
  });
  if (existing) throw new Error("Kutilayotgan uzaytirish so'rovi allaqachon mavjud");

  const extension = await prisma.rentalExtension.create({
    data: {
      orderId,
      extraHours: hours,
      extraPrice,
      previousEnd: order.endDatetime,
      newEnd: addHours(order.endDatetime, hours),
    },
  });

  const admins = await getAdminRecipients();
  const text =
    `⏳ *Ijara uzaytirish so'rovi*\n\n` +
    `Buyurtma: #${orderId}\n` +
    `Mijoz: ${order.user.fullName || "—"}\n` +
    `Qo'shimcha: ${hours} soat (${Math.round(hours / 24)} kun)\n` +
    `Narx: ${extraPrice.toLocaleString()} so'm`;

  for (const admin of admins) {
    await notify({
      orderId,
      type: "ORDER_CREATED",
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text,
      options: {
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

  return extension;
}

async function approveExtension(extensionId, adminContext = {}) {
  return prisma.$transaction(async (tx) => {
    const ext = await tx.rentalExtension.findUnique({
      where: { id: extensionId },
      include: { order: { include: { user: true } } },
    });
    if (!ext || ext.status !== "PENDING") throw new Error("So'rov topilmadi");

    const order = await tx.order.update({
      where: { id: ext.orderId },
      data: {
        endDatetime: ext.newEnd,
        totalPrice: { increment: ext.extraPrice },
      },
    });

    await tx.rentalExtension.update({
      where: { id: extensionId },
      data: {
        status: "APPROVED",
        resolvedAt: new Date(),
        resolvedByAdminId: adminContext.adminId ?? null,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: ext.orderId,
        status: order.status,
        actorType: "admin",
        actorId: adminContext.adminId,
        note: `Ijara ${ext.extraHours} soatga uzaytirildi (+${Number(ext.extraPrice)} so'm)`,
      },
    });

    await paymentService.initOrderPayment({ id: ext.orderId, totalPrice: ext.extraPrice, deliveryFee: 0 });

    await auditLogService.log({
      module: "RENTAL",
      adminId: adminContext.adminId,
      adminTelegramId: adminContext.telegramId,
      action: "RENTAL_EXTENSION_APPROVED",
      entityType: "RentalExtension",
      entityId: extensionId,
      afterData: { orderId: ext.orderId, extraHours: ext.extraHours, extraPrice: Number(ext.extraPrice) },
    });

    await notify({
      orderId: ext.orderId,
      type: "ORDER_ACCEPTED",
      recipientType: "user",
      recipientTelegramId: ext.order.user.telegramId.toString(),
      recipientId: ext.order.userId,
      text:
        `✅ *Ijara uzaytirildi*\n\n` +
        `Buyurtma #${ext.orderId}\n` +
        `Yangi tugash: ${formatDatetime(ext.newEnd)}\n` +
        `Qo'shimcha to'lov: ${Number(ext.extraPrice).toLocaleString()} so'm`,
    });

    return ext;
  });
}

async function rejectExtension(extensionId, adminContext = {}) {
  const ext = await prisma.rentalExtension.update({
    where: { id: extensionId },
    data: { status: "REJECTED", resolvedAt: new Date(), resolvedByAdminId: adminContext.adminId ?? null },
    include: { order: { include: { user: true } } },
  });
  await notify({
    orderId: ext.orderId,
    type: "ORDER_REJECTED",
    recipientType: "user",
    recipientTelegramId: ext.order.user.telegramId.toString(),
    recipientId: ext.order.userId,
    text: `❌ Buyurtma #${ext.orderId} uchun uzaytirish so'rovi rad etildi.`,
  });
  return ext;
}

module.exports = { requestExtension, approveExtension, rejectExtension };
