const prisma = require("../config/prisma");
const { ACTIVE_RENTAL_STATUSES } = require("../constants/orderStatus");
const { startOfDay, endOfDay } = require("../utils/dateHelper");

async function getAdminAlerts() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [newOrders, dueReturns, overdueRentals, pendingExtensions] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING", courierId: null } }),
    prisma.order.count({
      where: {
        status: { in: ["DELIVERED", "RETURN_REQUESTED"] },
        endDatetime: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.order.count({
      where: {
        status: { in: ACTIVE_RENTAL_STATUSES },
        endDatetime: { lt: now },
      },
    }),
    prisma.rentalExtension.count({ where: { status: "PENDING" } }),
  ]);

  return { newOrders, dueReturns, overdueRentals, pendingExtensions };
}

function formatAlerts(alerts) {
  const lines = [
    "🔔 *Sizda:*",
    `• ${alerts.newOrders} ta yangi buyurtma`,
    `• ${alerts.dueReturns} ta qaytarilishi kerak bo'lgan PlayStation`,
    `• ${alerts.overdueRentals} ta kechikayotgan ijara`,
  ];
  if (alerts.pendingExtensions > 0) {
    lines.push(`• ${alerts.pendingExtensions} ta uzaytirish so'rovi`);
  }
  return lines.join("\n");
}

module.exports = { getAdminAlerts, formatAlerts };
