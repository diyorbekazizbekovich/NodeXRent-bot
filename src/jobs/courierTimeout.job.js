const cron = require("node-cron");
const prisma = require("../config/prisma");
const env = require("../config/env");
const logger = require("../utils/logger");
const { getAdminRecipients } = require("../utils/adminRecipients");
const { notify } = require("../services/notification.service");
const { startOnce } = require("./jobGuard");

/**
 * PENDING holatida uzoq qolgan va hech qaysi kuryer qabul qilmagan buyurtmalar haqida adminlarga ogohlantirish.
 */
function startCourierTimeoutJob() {
  startOnce("courierTimeout", () => {
    cron.schedule("*/1 * * * *", async () => {
      try {
        const timeoutThreshold = new Date(
          Date.now() - env.COURIER_RESPONSE_TIMEOUT_MINUTES * 60 * 1000
        );

        const stuckOrders = await prisma.order.findMany({
          where: {
            status: "PENDING",
            courierId: null,
            createdAt: { lt: timeoutThreshold },
          },
        });

        if (stuckOrders.length === 0) return;

        const admins = await getAdminRecipients();

        for (const order of stuckOrders) {
          for (const admin of admins) {
            await notify({
              orderId: order.id,
              type: "ORDER_CREATED",
              recipientType: "admin",
              recipientTelegramId: String(admin.telegramId),
              recipientId: admin.recipientId,
              text: `⏰ Buyurtma #${order.id} ${env.COURIER_RESPONSE_TIMEOUT_MINUTES} daqiqadan beri kuryer kutmoqda. Qo'lda biriktiring.`,
            });
          }
          logger.info(`Buyurtma #${order.id} kuryer kutish vaqti oshdi`, {
            context: "CourierTimeoutJob",
          });
        }
      } catch (err) {
        logger.error("CourierTimeoutJob xatoligi", {
          context: "CourierTimeoutJob",
          error: err.message,
        });
      }
    });
  });
}

module.exports = { startCourierTimeoutJob };
