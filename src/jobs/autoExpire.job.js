const cron = require("node-cron");
const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const { notify } = require("../services/notification.service");
const { startOnce } = require("./jobGuard");

/**
 * Har 10 daqiqada ishlaydi: endDatetime o'tib ketgan, lekin hali qaytarilmagan
 * (DELIVERED yoki RETURN_REQUESTED) buyurtmalarni EXPIRED qiladi va foydalanuvchi
 * hamda kuryerga bildiradi. Kuryer haliham "Qaytarib oldim" tugmasi orqali yakunlashi mumkin.
 */
function startAutoExpireJob() {
  startOnce("autoExpire", () => {
    cron.schedule("*/10 * * * *", async () => {
      try {
        const now = new Date();
        const overdue = await prisma.order.findMany({
          where: {
            status: { in: ["DELIVERED", "ACTIVE", "RETURN_REQUESTED"] },
            endDatetime: { lt: now },
          },
          include: { user: true, courier: true },
        });

        for (const order of overdue) {
          await prisma.order.update({ where: { id: order.id }, data: { status: "EXPIRED" } });
          await prisma.orderStatusLog.create({ data: { orderId: order.id, status: "EXPIRED" } });

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
              text: `⌛ Buyurtma #${order.id} muddati tugadi. Konsolni qaytarib olish vaqti keldi.`,
            });
          }
        }

        if (overdue.length > 0) {
          logger.info(`${overdue.length} ta buyurtma EXPIRED qilindi`, { context: "AutoExpireJob" });
        }
      } catch (err) {
        logger.error("AutoExpireJob xatoligi", { context: "AutoExpireJob", error: err.message });
      }
    });
  });
}

module.exports = { startAutoExpireJob };
