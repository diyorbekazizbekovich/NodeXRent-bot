const cron = require("node-cron");
const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const { notify } = require("../services/notification.service");
const { getAdminRecipients } = require("../utils/adminRecipients");
const deviceStatusService = require("../services/deviceStatus.service");
const { startOnce } = require("./jobGuard");

/**
 * Muddat o'tganda order → EXPIRED, lekin qurilma AVAILABLE bo'lMAYDI.
 * Qurilma RENTED / band holatda qoladi — faqat return/cancel bo'shatadi.
 */
function startAutoExpireJob() {
  startOnce("autoExpire", () => {
    cron.schedule("*/10 * * * *", async () => {
      try {
        const now = new Date();
        const overdue = await prisma.order.findMany({
          where: {
            status: { in: ["DELIVERED", "ACTIVE"] },
            OR: [
              { expectedReturnAt: { lt: now } },
              { AND: [{ expectedReturnAt: null }, { endDatetime: { lt: now } }] },
            ],
          },
          include: { user: true, courier: true, playstation: true },
        });

        for (const order of overdue) {
          await prisma.$transaction(async (tx) => {
            await tx.order.update({ where: { id: order.id }, data: { status: "EXPIRED" } });
            await tx.orderStatusLog.create({
              data: {
                orderId: order.id,
                status: "EXPIRED",
                actorType: "system",
                note: "Overdue — device stays RENTED until return",
              },
            });

            // Explicit sync: EXPIRED → device stays RENTED (never AVAILABLE)
            await deviceStatusService.syncDeviceToOrderStatus(tx, order, "EXPIRED", {
              actorType: "system",
              reason: "AUTO_EXPIRE_OVERDUE",
            });
          });

          const { t, resolveLang } = require("../i18n");
          const L = resolveLang(order.user?.language);
          await notify({
            orderId: order.id,
            type: "RETURN_REMINDER",
            recipientType: "user",
            recipientTelegramId: order.user.telegramId.toString(),
            recipientId: order.userId,
            text: t("notify.expired", L, { id: order.id }),
          });

          if (order.courier) {
            await notify({
              orderId: order.id,
              type: "RETURN_REMINDER",
              recipientType: "courier",
              recipientTelegramId: order.courier.telegramId.toString(),
              recipientId: order.courierId,
              text:
                `⏰ OVERDUE — Buyurtma #${order.id}\n` +
                `Ijara muddati tugagan. Qurilma hali RENTED.\n` +
                `Konsolni qaytarib oling — Available faqat return dan keyin.`,
            });
          }

          const admins = await getAdminRecipients();
          for (const admin of admins) {
            await notify({
              orderId: order.id,
              type: "RETURN_REMINDER",
              recipientType: "admin",
              recipientTelegramId: String(admin.telegramId),
              recipientId: admin.recipientId,
              text:
                `⏰ OVERDUE #${order.id}\n` +
                `PS: ${order.playstation?.serialNumber || order.playstationId || "—"}\n` +
                `Mijoz: ${order.user?.fullName || "—"}\n` +
                `Qurilma band holatda qoldi (Available emas).`,
            });
          }
        }

        if (overdue.length > 0) {
          logger.info(`${overdue.length} ta buyurtma EXPIRED (device still occupied)`, {
            context: "AutoExpireJob",
          });
        }
      } catch (err) {
        logger.error("AutoExpireJob xatoligi", { context: "AutoExpireJob", error: err.message });
      }
    });
  });
}

module.exports = { startAutoExpireJob };
