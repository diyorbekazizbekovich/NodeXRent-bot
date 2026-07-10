const cron = require("node-cron");
const prisma = require("../config/prisma");
const env = require("../config/env");
const logger = require("../utils/logger");
const { notify } = require("../services/notification.service");
const { startOnce } = require("./jobGuard");

/**
 * Har 5 daqiqada ishlaydi: endDatetime'gacha RETURN_REMINDER_HOURS_BEFORE soat qolgan
 * va hali eslatma yuborilmagan DELIVERED holatidagi buyurtmalarni topib, foydalanuvchiga xabar beradi.
 */
function startReminderJob() {
  startOnce("reminder", () => {
    cron.schedule("*/5 * * * *", async () => {
      try {
        const now = new Date();
        const windowStart = new Date(
          now.getTime() + (env.RETURN_REMINDER_HOURS_BEFORE * 60 - 5) * 60 * 1000
        );
        const windowEnd = new Date(now.getTime() + env.RETURN_REMINDER_HOURS_BEFORE * 60 * 60 * 1000);

        const orders = await prisma.order.findMany({
          where: {
            status: { in: ["DELIVERED", "ACTIVE"] },
            endDatetime: { gte: windowStart, lte: windowEnd },
          },
          include: { user: true },
        });

        for (const order of orders) {
          const alreadySent = await prisma.notification.findFirst({
            where: { orderId: order.id, type: "RETURN_REMINDER" },
          });
          if (alreadySent) continue;

          const { t, resolveLang } = require("../i18n");
          const L = resolveLang(order.user?.language);
          await notify({
            orderId: order.id,
            type: "RETURN_REMINDER",
            recipientType: "user",
            recipientTelegramId: order.user.telegramId.toString(),
            recipientId: order.userId,
            text: t("notify.reminder", L, {
              id: order.id,
              hours: env.RETURN_REMINDER_HOURS_BEFORE,
            }),
          });
        }

        if (orders.length > 0) {
          logger.info(`Eslatma yuborildi: ${orders.length} ta buyurtma`, { context: "ReminderJob" });
        }
      } catch (err) {
        logger.error("ReminderJob xatoligi", { context: "ReminderJob", error: err.message });
      }
    });
  });
}

module.exports = { startReminderJob };
