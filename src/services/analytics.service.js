const prisma = require("../config/prisma");
const { REVENUE_STATUSES } = require("../constants/orderStatus");
const { startOfDay, endOfDay, daysAgo, startOfMonth } = require("../utils/dateHelper");

const ALLOWED_RENTAL_HOURS = [24, 48, 72];

function formatMoney(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;
}

function bar(value, max, width = 10) {
  const len = max > 0 ? Math.round((value / max) * width) : 0;
  return "█".repeat(len) + "░".repeat(Math.max(width - len, 0));
}

async function sumRevenue(where) {
  const agg = await prisma.order.aggregate({
    where: { ...where, status: { in: REVENUE_STATUSES } },
    _sum: { totalPrice: true, deliveryFee: true },
  });
  return Number(agg._sum.totalPrice ?? 0) + Number(agg._sum.deliveryFee ?? 0);
}

async function countOrders(where) {
  return prisma.order.count({ where });
}

async function getFullAnalytics() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = daysAgo(7);
  const monthStart = startOfMonth(now);

  const [
    totalUsers,
    usersToday,
    usersWeek,
    usersMonth,
    totalOrders,
    ordersToday,
    ordersWeek,
    ordersMonth,
    completedOrders,
    cancelledOrders,
    pendingOrders,
    revenueToday,
    revenueWeek,
    revenueMonth,
    revenueTotal,
    topConsole,
    topDuration,
    topCourierRow,
    promoStats,
    returningCustomersRaw,
    avgOrder,
    dailyRevenue,
    dailyOrders,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.order.count(),
    countOrders({ createdAt: { gte: todayStart, lte: todayEnd } }),
    countOrders({ createdAt: { gte: weekStart } }),
    countOrders({ createdAt: { gte: monthStart } }),
    countOrders({ status: { in: ["COMPLETED", "RETURNED"] } }),
    countOrders({ status: { in: ["CANCELLED", "EXPIRED"] } }),
    countOrders({ status: "PENDING" }),
    sumRevenue({ createdAt: { gte: todayStart, lte: todayEnd } }),
    sumRevenue({ createdAt: { gte: weekStart } }),
    sumRevenue({ createdAt: { gte: monthStart } }),
    sumRevenue({}),
    prisma.order.groupBy({
      by: ["consoleType"],
      where: { status: { in: REVENUE_STATUSES } },
      _count: { _all: true },
      orderBy: { _count: { consoleType: "desc" } },
      take: 1,
    }),
    prisma.order.groupBy({
      by: ["rentalPriceId"],
      where: { status: { in: REVENUE_STATUSES } },
      _count: { _all: true },
      orderBy: { _count: { rentalPriceId: "desc" } },
      take: 1,
    }),
    prisma.order.groupBy({
      by: ["courierId"],
      where: { courierId: { not: null }, status: { in: REVENUE_STATUSES } },
      _count: { _all: true },
      orderBy: { _count: { courierId: "desc" } },
      take: 1,
    }),
    prisma.promocode.findMany({
      select: { code: true, usedCount: true, usageLimit: true, isActive: true },
      orderBy: { usedCount: "desc" },
      take: 5,
    }),
    prisma.order.groupBy({ by: ["userId"], _count: { _all: true } }),
    prisma.order.aggregate({
      where: { status: { in: REVENUE_STATUSES } },
      _avg: { totalPrice: true },
    }),
    buildDailySeries(7, "revenue"),
    buildDailySeries(7, "orders"),
  ]);

  let topDurationLabel = "—";
  if (topDuration[0]) {
    const rp = await prisma.rentalPrice.findUnique({ where: { id: topDuration[0].rentalPriceId } });
    if (rp) topDurationLabel = rp.hours === 24 ? "1 kun" : rp.hours === 48 ? "2 kun" : rp.hours === 72 ? "3 kun" : `${rp.hours} soat`;
  }

  let topCourierName = "—";
  if (topCourierRow[0]?.courierId) {
    const c = await prisma.courier.findUnique({ where: { id: topCourierRow[0].courierId } });
    topCourierName = c?.fullName || `#${topCourierRow[0].courierId}`;
  }

  const cancelRate = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0;

  return {
    users: { total: totalUsers, today: usersToday, week: usersWeek, month: usersMonth },
    orders: {
      total: totalOrders,
      today: ordersToday,
      week: ordersWeek,
      month: ordersMonth,
      completed: completedOrders,
      cancelled: cancelledOrders,
      pending: pendingOrders,
      cancelRate,
    },
    revenue: {
      today: revenueToday,
      week: revenueWeek,
      month: revenueMonth,
      total: revenueTotal,
      avgOrder: Number(avgOrder._avg.totalPrice ?? 0),
    },
    top: {
      console: topConsole[0]?.consoleType || "—",
      duration: topDurationLabel,
      courier: topCourierName,
    },
    promoStats,
    returningCustomers: returningCustomersRaw.filter((g) => g._count._all > 1).length,
    dailyRevenue,
    dailyOrders,
  };
}

async function buildDailySeries(days, type) {
  const rows = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const start = startOfDay(d);
    const end = endOfDay(d);
    const label = start.toISOString().slice(0, 10);
    if (type === "revenue") {
      rows.push({ label, value: await sumRevenue({ createdAt: { gte: start, lte: end } }) });
    } else {
      rows.push({ label, value: await countOrders({ createdAt: { gte: start, lte: end } }) });
    }
  }
  return rows;
}

function formatAnalytics(data) {
  const u = data.users;
  const o = data.orders;
  const r = data.revenue;
  const lines = [
    "📈 *Analytics Dashboard*",
    "",
    "👥 *Foydalanuvchilar*",
    `Jami: ${u.total} | Bugun: +${u.today} | Hafta: +${u.week} | Oy: +${u.month}`,
    "",
    "📦 *Buyurtmalar*",
    `Jami: ${o.total} | Bugun: ${o.today} | Hafta: ${o.week} | Oy: ${o.month}`,
    `Bajarilgan: ${o.completed} | Bekor: ${o.cancelled} (${o.cancelRate}%) | Kutilmoqda: ${o.pending}`,
    "",
    "💰 *Daromad*",
    `Bugun: ${formatMoney(r.today)} | Hafta: ${formatMoney(r.week)}`,
    `Oy: ${formatMoney(r.month)} | Jami: ${formatMoney(r.total)}`,
    `O'rtacha buyurtma: ${formatMoney(r.avgOrder)}`,
    "",
    "🏆 *Top*",
    `PlayStation: ${data.top.console}`,
    `Ijara muddati: ${data.top.duration}`,
    `Kuryer: ${data.top.courier}`,
    `Qaytib keluvchi mijozlar: ${data.returningCustomers}`,
    "",
    "🏷 *Promo statistika*",
  ];

  if (!data.promoStats.length) lines.push("Promo yo'q.");
  else data.promoStats.forEach((p) => lines.push(`• ${p.code}: ${p.usedCount}/${p.usageLimit} ${p.isActive ? "" : "(o'chirilgan)"}`));

  lines.push("", "*Daromad grafigi (7 kun)*");
  const maxR = Math.max(...data.dailyRevenue.map((d) => d.value), 1);
  data.dailyRevenue.forEach((d) => lines.push(`${d.label}: ${bar(d.value, maxR)} ${formatMoney(d.value)}`));

  lines.push("", "*Buyurtmalar grafigi (7 kun)*");
  const maxO = Math.max(...data.dailyOrders.map((d) => d.value), 1);
  data.dailyOrders.forEach((d) => lines.push(`${d.label}: ${bar(d.value, maxO)} ${d.value} ta`));

  return lines.join("\n");
}

async function getAnalyticsReport() {
  return getFullAnalytics();
}

module.exports = {
  ALLOWED_RENTAL_HOURS,
  getFullAnalytics,
  getAnalyticsReport,
  formatAnalytics,
};
