const cron = require("node-cron");
const prisma = require("../config/prisma");
const env = require("../config/env");
const logger = require("../utils/logger");
const orderAssignmentService = require("../services/orderAssignment.service");
const { OrderStatus } = require("../constants/orderStatus");
const { startOnce } = require("./jobGuard");

/**
 * ADMIN_CONFIRMED poolda kuryer javob bermasa — timeout.
 * PENDING admin tasdig'ini kutadi (bu job bekor qilmaydi).
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
            status: { in: [OrderStatus.ADMIN_CONFIRMED, OrderStatus.ACCEPTED] },
            courierId: null,
            confirmedAt: { lt: timeoutThreshold },
          },
          select: { id: true, confirmedAt: true, createdAt: true },
        });

        if (stuckOrders.length === 0) return;

        for (const order of stuckOrders) {
          try {
            await orderAssignmentService.cancelOrderBySystem(order.id, {
              note: `Admin tasdiqlagan buyurtmaga kuryer javob bermadi (${env.COURIER_RESPONSE_TIMEOUT_MINUTES} daqiqa)`,
              reason: "COURIER_TIMEOUT",
            });
            logger.info(`Buyurtma #${order.id} courier-pool timeout — CANCELLED`, {
              context: "CourierTimeoutJob",
            });
          } catch (err) {
            logger.warn(`Timeout cancel failed for #${order.id}`, {
              context: "CourierTimeoutJob",
              error: err.message,
            });
          }
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
