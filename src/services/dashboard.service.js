const prisma = require("../config/prisma");
const { REVENUE_STATUSES, ACTIVE_RENTAL_STATUSES } = require("../constants/orderStatus");
const { startOfDay, endOfDay, daysAgo, startOfMonth } = require("../utils/dateHelper");

function decimalSum(agg) {
  const price = Number(agg._sum?.totalPrice ?? 0);
  const fee = Number(agg._sum?.deliveryFee ?? 0);
  return price + fee;
}

async function sumRevenue(where) {
  const agg = await prisma.order.aggregate({
    where: { ...where, status: { in: REVENUE_STATUSES } },
    _sum: { totalPrice: true, deliveryFee: true },
  });
  return decimalSum(agg);
}

async function getDashboardStats() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = daysAgo(7);
  const monthStart = startOfMonth(now);

  const [
    todayRevenue,
    weekRevenue,
    monthRevenue,
    totalRevenue,
    todayOrders,
    todayAccepted,
    todayCancelled,
    todayCompleted,
    activeRentals,
    overdueRentals,
    totalOrders,
    inventoryByType,
    todayByConsole,
  ] = await Promise.all([
    sumRevenue({ createdAt: { gte: todayStart, lte: todayEnd } }),
    sumRevenue({ createdAt: { gte: weekStart } }),
    sumRevenue({ createdAt: { gte: monthStart } }),
    sumRevenue({}),
    prisma.order.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.order.count({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        status: { in: ["ACCEPTED", "COURIER_ASSIGNED", "ON_THE_WAY", "ARRIVED", "DELIVERED", "RETURNED", "COMPLETED"] },
      },
    }),
    prisma.order.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { in: ["CANCELLED", "EXPIRED"] } },
    }),
    prisma.order.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { in: ["COMPLETED", "RETURNED"] } },
    }),
    prisma.order.count({ where: { status: { in: ACTIVE_RENTAL_STATUSES } } }),
    prisma.order.count({
      where: {
        OR: [
          { status: "EXPIRED" },
          {
            status: { in: [...ACTIVE_RENTAL_STATUSES] },
            endDatetime: { lt: now },
          },
        ],
      },
    }),
    prisma.order.count(),
    prisma.inventoryUnit.groupBy({
      by: ["consoleType", "status"],
      _count: { _all: true },
    }),
    getTodayStatsByConsole(todayStart, todayEnd),
  ]);

  const playstations = buildConsoleStats(inventoryByType);

  return {
    revenue: {
      today: todayRevenue,
      week: weekRevenue,
      month: monthRevenue,
      total: totalRevenue,
    },
    orders: {
      today: todayOrders,
      todayAccepted,
      todayCancelled,
      todayCompleted,
      activeRentals,
      overdueRentals,
      total: totalOrders,
    },
    playstations,
    todayByConsole,
  };
}

function buildConsoleStats(grouped) {
  const types = ["PS3", "PS4", "PS5"];
  const map = {};
  for (const t of types) {
    map[t] = { total: 0, rented: 0, available: 0 };
  }
  for (const row of grouped) {
    const t = row.consoleType;
    if (!map[t]) map[t] = { total: 0, rented: 0, available: 0 };
    map[t].total += row._count._all;
    if (row.status === "RENTED" || row.status === "RESERVED") map[t].rented += row._count._all;
    if (row.status === "AVAILABLE") map[t].available += row._count._all;
  }
  return map;
}

async function getTodayStatsByConsole(todayStart, todayEnd) {
  const types = ["PS3", "PS4", "PS5"];
  const result = {};
  for (const consoleType of types) {
    const base = { consoleType, createdAt: { gte: todayStart, lte: todayEnd } };
    const [total, accepted, cancelled, delivered, returned] = await Promise.all([
      prisma.order.count({ where: base }),
      prisma.order.count({
        where: {
          ...base,
          status: { in: ["ACCEPTED", "COURIER_ASSIGNED", "ON_THE_WAY", "ARRIVED", "DELIVERED", "RETURNED", "COMPLETED"] },
        },
      }),
      prisma.order.count({ where: { ...base, status: { in: ["CANCELLED", "EXPIRED"] } } }),
      prisma.order.count({ where: { ...base, status: "DELIVERED" } }),
      prisma.order.count({ where: { ...base, status: { in: ["RETURNED", "COMPLETED"] } } }),
    ]);
    result[consoleType] = { total, accepted, cancelled, delivered, returned };
  }
  return result;
}

function formatMoney(n) {
  return `${Math.round(Number(n)).toLocaleString("uz-UZ")} so'm`;
}

function formatDashboard(stats) {
  const { escapeHtml } = require("../utils/telegramFormat");
  const lines = [
    "📊 <b>Admin Dashboard</b>",
    "",
    "💰 <b>Daromad</b>",
    `• Bugun: ${escapeHtml(formatMoney(stats.revenue.today))}`,
    `• 7 kun: ${escapeHtml(formatMoney(stats.revenue.week))}`,
    `• Oy: ${escapeHtml(formatMoney(stats.revenue.month))}`,
    `• Jami: ${escapeHtml(formatMoney(stats.revenue.total))}`,
    "",
    "📦 <b>Buyurtmalar</b>",
    `• Bugun: ${stats.orders.today}`,
    `• Qabul qilingan: ${stats.orders.todayAccepted}`,
    `• Bekor: ${stats.orders.todayCancelled}`,
    `• Yakunlangan: ${stats.orders.todayCompleted}`,
    `• Faol ijaralar: ${stats.orders.activeRentals}`,
    `• ⏰ Overdue: ${stats.orders.overdueRentals || 0}`,
    `• Jami: ${stats.orders.total}`,
    "",
    "🎮 <b>PlayStation inventar</b>",
  ];
  for (const t of ["PS3", "PS4", "PS5"]) {
    const ps = stats.playstations[t] || { total: 0, rented: 0, available: 0 };
    lines.push(`<b>${t}</b> — Jami: ${ps.total} | Band: ${ps.rented} | Bo'sh: ${ps.available}`);
  }
  return lines.join("\n");
}

function formatTodayBlock(stats) {
  const lines = ["📅 <b>Bugungi statistika (model bo'yicha)</b>", ""];
  for (const t of ["PS3", "PS4", "PS5"]) {
    const s = stats.todayByConsole[t];
    lines.push(
      `<b>${t}</b>`,
      `• Buyurtmalar: ${s.total}`,
      `• Qabul qilingan: ${s.accepted}`,
      `• Bekor: ${s.cancelled}`,
      `• Yetkazilgan: ${s.delivered}`,
      `• Qaytarilgan: ${s.returned}`,
      ""
    );
  }
  return lines.join("\n");
}

module.exports = {
  getDashboardStats,
  formatDashboard,
  formatTodayBlock,
  sumRevenue,
};
