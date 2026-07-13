const prisma = require("../config/prisma");
const { REVENUE_STATUSES, ACTIVE_RENTAL_STATUSES } = require("../constants/orderStatus");
const { startOfDay, endOfDay, daysAgo, startOfMonth } = require("../utils/dateHelper");
const dashboardService = require("./dashboard.service");

function decimalSum(agg) {
  return Number(agg._sum?.totalPrice ?? 0) + Number(agg._sum?.deliveryFee ?? 0);
}

async function getKpiStats() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = daysAgo(7);
  const monthStart = startOfMonth(now);

  const base = await dashboardService.getDashboardStats();

  const [
    todayProfit,
    weekProfit,
    monthProfit,
    avgOrder,
    avgDuration,
    totalUnits,
    rentedUnits,
    topConsole,
    topCustomer,
    topCourier,
    cancelledCount,
    totalCount,
  ] = await Promise.all([
    dashboardService.sumRevenue({ createdAt: { gte: todayStart } }),
    dashboardService.sumRevenue({ createdAt: { gte: weekStart } }),
    dashboardService.sumRevenue({ createdAt: { gte: monthStart } }),
    prisma.order.aggregate({
      where: { status: { in: REVENUE_STATUSES } },
      _avg: { totalPrice: true },
    }),
    Promise.resolve(null),
    prisma.inventoryUnit.count(),
    prisma.inventoryUnit.count({ where: { status: { in: ["RENTED", "RESERVED"] } } }),
    prisma.order.groupBy({
      by: ["consoleType"],
      where: { status: { in: REVENUE_STATUSES } },
      _count: { _all: true },
      orderBy: { _count: { consoleType: "desc" } },
      take: 1,
    }),
    prisma.order.groupBy({
      by: ["userId"],
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 1,
    }),
    prisma.order.groupBy({
      by: ["courierId"],
      where: { courierId: { not: null }, status: { in: REVENUE_STATUSES } },
      _count: { _all: true },
      orderBy: { _count: { courierId: "desc" } },
      take: 1,
    }),
    prisma.order.count({ where: { status: { in: ["CANCELLED", "EXPIRED"] } } }),
    prisma.order.count(),
  ]);

  const occupancyRate = totalUnits > 0 ? Math.round((rentedUnits / totalUnits) * 100) : 0;
  const cancelRate = totalCount > 0 ? Math.round((cancelledCount / totalCount) * 100) : 0;

  let topCustomerName = "—";
  if (topCustomer[0]) {
    const u = await prisma.user.findUnique({ where: { id: topCustomer[0].userId } });
    topCustomerName = u?.fullName || u?.username || `#${topCustomer[0].userId}`;
  }
  let topCourierName = "—";
  if (topCourier[0]?.courierId) {
    const c = await prisma.courier.findUnique({ where: { id: topCourier[0].courierId } });
    topCourierName = c?.fullName || `#${topCourier[0].courierId}`;
  }

  const revenueOrders = await prisma.order.findMany({
    where: { status: { in: REVENUE_STATUSES } },
    select: { startDatetime: true, endDatetime: true },
    take: 500,
  });
  let avgHours = 0;
  if (revenueOrders.length) {
    const totalH = revenueOrders.reduce(
      (s, o) => s + (new Date(o.endDatetime) - new Date(o.startDatetime)) / 3600000,
      0
    );
    avgHours = Math.round(totalH / revenueOrders.length);
  }

  return {
    ...base,
    kpi: {
      todayProfit,
      weekProfit,
      monthProfit,
      avgOrderAmount: Number(avgOrder._avg.totalPrice ?? 0),
      avgRentalHours: avgHours,
      occupancyRate,
      topConsole: topConsole[0]?.consoleType || "—",
      topCustomer: topCustomerName,
      topCourier: topCourierName,
      cancelRate,
    },
  };
}

function formatKpiDashboard(stats) {
  const { escapeHtml } = require("../utils/telegramFormat");
  const base = dashboardService.formatDashboard(stats);
  const k = stats.kpi;
  return (
    base +
    "\n\n📈 <b>KPI</b>\n" +
    `• Bugungi foyda: ${escapeHtml(String(Math.round(k.todayProfit).toLocaleString()))} so'm\n` +
    `• Haftalik foyda: ${escapeHtml(String(Math.round(k.weekProfit).toLocaleString()))} so'm\n` +
    `• Oylik foyda: ${escapeHtml(String(Math.round(k.monthProfit).toLocaleString()))} so'm\n` +
    `• O'rtacha buyurtma: ${escapeHtml(String(Math.round(k.avgOrderAmount).toLocaleString()))} so'm\n` +
    `• O'rtacha ijara: ${escapeHtml(k.avgRentalHours)} soat\n` +
    `• Bandlik: ${escapeHtml(k.occupancyRate)}%\n` +
    `• Top model: ${escapeHtml(k.topConsole)}\n` +
    `• Top mijoz: ${escapeHtml(k.topCustomer)}\n` +
    `• Top kuryer: ${escapeHtml(k.topCourier)}\n` +
    `• Bekor foizi: ${escapeHtml(k.cancelRate)}%`
  );
}

module.exports = { getKpiStats, formatKpiDashboard };
