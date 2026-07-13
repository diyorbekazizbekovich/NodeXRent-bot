const prisma = require("../config/prisma");
const { startOfDay, startOfMonth } = require("../utils/dateHelper");

async function getCourierStats(courierId) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);

  const deliveredStatuses = ["DELIVERED", "RETURNED", "COMPLETED"];

  const [todayCount, monthCount, totalCount, earningsAgg, courier] = await Promise.all([
    prisma.order.count({
      where: { courierId, status: { in: deliveredStatuses }, deliveryCompletedAt: { gte: todayStart } },
    }),
    prisma.order.count({
      where: { courierId, status: { in: deliveredStatuses }, deliveryCompletedAt: { gte: monthStart } },
    }),
    prisma.order.count({
      where: { courierId, status: { in: deliveredStatuses } },
    }),
    prisma.order.aggregate({
      where: { courierId, status: { in: deliveredStatuses } },
      _sum: { deliveryFee: true },
    }),
    prisma.courier.findUnique({ where: { id: courierId } }),
  ]);

  return {
    courier,
    todayDeliveries: todayCount,
    monthDeliveries: monthCount,
    totalDeliveries: totalCount,
    earnings: Number(earningsAgg._sum.deliveryFee ?? 0),
    rating: Number(courier?.rating ?? 5),
  };
}

async function getTopCouriers(limit = 10) {
  const rows = await prisma.order.groupBy({
    by: ["courierId"],
    where: { courierId: { not: null }, status: { in: ["DELIVERED", "RETURNED", "COMPLETED"] } },
    _count: { _all: true },
    orderBy: { _count: { courierId: "desc" } },
    take: limit,
  });
  const ids = rows.map((r) => r.courierId).filter(Boolean);
  const couriers = await prisma.courier.findMany({ where: { id: { in: ids } } });
  const map = Object.fromEntries(couriers.map((c) => [c.id, c]));
  return rows.map((r) => ({
    courier: map[r.courierId],
    deliveries: r._count._all,
    rating: Number(map[r.courierId]?.rating ?? 5),
  }));
}

function formatCourierStats(stats) {
  const { escapeHtml } = require("../utils/telegramFormat");
  return (
    `🚚 <b>Kuryer statistikasi</b>\n\n` +
    `👤 ${escapeHtml(stats.courier?.fullName || "—")}\n` +
    `⭐ Reyting: ${stats.rating.toFixed(1)}\n\n` +
    `• Bugun: ${stats.todayDeliveries}\n` +
    `• Oy: ${stats.monthDeliveries}\n` +
    `• Jami: ${stats.totalDeliveries}\n` +
    `• Topgan puli: ${escapeHtml(stats.earnings.toLocaleString())} so'm`
  );
}

function formatTopCouriers(list) {
  const { escapeHtml } = require("../utils/telegramFormat");
  const lines = ["🏆 <b>Eng faol kuryerlar</b>", ""];
  list.forEach((item, i) => {
    lines.push(
      `${i + 1}. ${escapeHtml(item.courier?.fullName || "—")} — ${item.deliveries} ta (⭐ ${item.rating.toFixed(1)})`
    );
  });
  return lines.join("\n");
}

module.exports = { getCourierStats, getTopCouriers, formatCourierStats, formatTopCouriers };
