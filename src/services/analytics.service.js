const prisma = require("../config/prisma");
const {
  REVENUE_STATUSES,
  ACTIVE_RENTAL_STATUSES,
} = require("../constants/orderStatus");
const { startOfDay, endOfDay, daysAgo, startOfMonth, formatDatetime } = require("../utils/dateHelper");

const PERIODS = Object.freeze({
  today: "today",
  week: "week",
  month: "month",
  all: "all",
});

const PERIOD_LABELS = {
  today: "📅 Bugun",
  week: "📆 Hafta",
  month: "🗓 Oy",
  all: "♾ Umumiy",
};

function formatMoney(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function periodRange(period, now = new Date()) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  switch (period) {
    case PERIODS.today:
      return { gte: todayStart, lte: todayEnd, label: PERIOD_LABELS.today };
    case PERIODS.week:
      return { gte: daysAgo(7, now), lte: todayEnd, label: PERIOD_LABELS.week };
    case PERIODS.month:
      return { gte: startOfMonth(now), lte: todayEnd, label: PERIOD_LABELS.month };
    case PERIODS.all:
    default:
      return { gte: null, lte: null, label: PERIOD_LABELS.all };
  }
}

function createdAtFilter(range) {
  if (!range.gte) return {};
  const createdAt = { gte: range.gte };
  if (range.lte) createdAt.lte = range.lte;
  return { createdAt };
}

async function sumOrderMoney(where) {
  const agg = await prisma.order.aggregate({
    where: { ...where, status: { in: REVENUE_STATUSES } },
    _sum: { totalPrice: true, deliveryFee: true },
  });
  return {
    rental: Number(agg._sum.totalPrice ?? 0),
    delivery: Number(agg._sum.deliveryFee ?? 0),
    total: Number(agg._sum.totalPrice ?? 0) + Number(agg._sum.deliveryFee ?? 0),
  };
}

async function sumPromoDiscounts(where = {}) {
  const orders = await prisma.order.findMany({
    where: {
      ...where,
      promocodeId: { not: null },
      status: { in: REVENUE_STATUSES },
    },
    select: {
      totalPrice: true,
      rentalPrice: { select: { price: true } },
    },
  });
  let discount = 0;
  for (const o of orders) {
    const base = Number(o.rentalPrice?.price ?? 0);
    const paid = Number(o.totalPrice ?? 0);
    if (base > paid) discount += base - paid;
  }
  return discount;
}

function pivotInventory(rows) {
  const types = ["PS3", "PS4", "PS5"];
  const result = {};
  for (const t of types) {
    result[t] = { total: 0, available: 0, rented: 0, maintenance: 0 };
  }
  for (const row of rows) {
    const t = row.consoleType;
    if (!result[t]) continue;
    const n = row._count._all;
    result[t].total += n;
    if (row.status === "AVAILABLE") result[t].available += n;
    else if (row.status === "RENTED" || row.status === "RESERVED") result[t].rented += n;
    else if (row.status === "MAINTENANCE") result[t].maintenance += n;
  }
  return result;
}

/**
 * @param {"today"|"week"|"month"|"all"} period
 */
async function getAnalyticsDashboard(period = PERIODS.today) {
  const safePeriod = PERIODS[period] ? period : PERIODS.today;
  const now = new Date();
  const range = periodRange(safePeriod, now);
  const periodWhere = createdAtFilter(range);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = daysAgo(7, now);
  const monthStart = startOfMonth(now);
  const todayWhere = { createdAt: { gte: todayStart, lte: todayEnd } };

  const [
    periodOrders,
    periodActive,
    periodCompleted,
    periodCancelled,
    periodRejected,
    periodRevenue,
    periodPromoDiscount,

    totalUsers,
    activeUsers,
    newUsersPeriod,
    totalOrders,
    activeRentals,
    inventoryRows,

    revenueToday,
    revenueWeek,
    revenueMonth,
    revenueAll,
    promoDiscountAll,
    deliveryToday,
    deliveryWeek,
    deliveryMonth,
    deliveryAll,

    couriers,
    courierDelivered,
    courierActive,
    courierToday,
  ] = await Promise.all([
    prisma.order.count({ where: periodWhere }),
    prisma.order.count({
      where: { ...periodWhere, status: { in: ACTIVE_RENTAL_STATUSES } },
    }),
    prisma.order.count({
      where: { ...periodWhere, status: { in: ["COMPLETED", "RETURNED"] } },
    }),
    prisma.order.count({
      where: { ...periodWhere, status: { in: ["CANCELLED", "EXPIRED"] } },
    }),
    prisma.order.count({ where: { ...periodWhere, status: "REJECTED" } }),
    sumOrderMoney(periodWhere),
    sumPromoDiscounts(periodWhere),

    prisma.user.count(),
    prisma.user.count({
      where: { lastActivityAt: { gte: daysAgo(30, now) } },
    }),
    prisma.user.count({ where: periodWhere.createdAt ? { createdAt: periodWhere.createdAt } : {} }),
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ACTIVE_RENTAL_STATUSES } } }),
    prisma.inventoryItem.groupBy({
      by: ["consoleType", "status"],
      where: { itemType: "CONSOLE", consoleType: { not: null } },
      _count: { _all: true },
    }),

    sumOrderMoney(todayWhere),
    sumOrderMoney({ createdAt: { gte: weekStart } }),
    sumOrderMoney({ createdAt: { gte: monthStart } }),
    sumOrderMoney({}),
    sumPromoDiscounts({}),
    prisma.order.aggregate({
      where: { ...todayWhere, status: { in: REVENUE_STATUSES } },
      _sum: { deliveryFee: true },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: weekStart }, status: { in: REVENUE_STATUSES } },
      _sum: { deliveryFee: true },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: monthStart }, status: { in: REVENUE_STATUSES } },
      _sum: { deliveryFee: true },
    }),
    prisma.order.aggregate({
      where: { status: { in: REVENUE_STATUSES } },
      _sum: { deliveryFee: true },
    }),

    prisma.courier.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 20,
    }),
    prisma.order.groupBy({
      by: ["courierId"],
      where: {
        courierId: { not: null },
        status: { in: ["DELIVERED", "ACTIVE", "RETURN_REQUESTED", "RETURNED", "COMPLETED"] },
      },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["courierId"],
      where: { courierId: { not: null }, status: { in: ACTIVE_RENTAL_STATUSES } },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["courierId"],
      where: {
        courierId: { not: null },
        OR: [
          { deliveryCompletedAt: { gte: todayStart, lte: todayEnd } },
          {
            deliveryCompletedAt: null,
            status: { in: ["DELIVERED", "ACTIVE", "RETURNED", "COMPLETED"] },
            updatedAt: { gte: todayStart, lte: todayEnd },
          },
        ],
      },
      _count: { _all: true },
    }),
  ]);

  const inventory = pivotInventory(inventoryRows);
  const invTotals = Object.values(inventory).reduce(
    (acc, row) => {
      acc.total += row.total;
      acc.available += row.available;
      acc.rented += row.rented;
      acc.maintenance += row.maintenance;
      return acc;
    },
    { total: 0, available: 0, rented: 0, maintenance: 0 }
  );

  const deliveredMap = Object.fromEntries(
    courierDelivered.filter((r) => r.courierId).map((r) => [r.courierId, r._count._all])
  );
  const activeMap = Object.fromEntries(
    courierActive.filter((r) => r.courierId).map((r) => [r.courierId, r._count._all])
  );
  const todayMap = Object.fromEntries(
    courierToday.filter((r) => r.courierId).map((r) => [r.courierId, r._count._all])
  );

  const courierStats = couriers.map((c) => ({
    id: c.id,
    name: c.fullName || `Kuryer #${c.id}`,
    delivered: deliveredMap[c.id] || 0,
    active: activeMap[c.id] || 0,
    today: todayMap[c.id] || 0,
  }));

  return {
    period: safePeriod,
    periodLabel: range.label,
    generatedAt: now,
    periodStats: {
      orders: periodOrders,
      active: periodActive,
      completed: periodCompleted,
      cancelled: periodCancelled,
      rejected: periodRejected,
      revenue: periodRevenue.total,
    },
    overview: {
      totalUsers,
      activeUsers,
      newUsers: newUsersPeriod,
      totalOrders,
      activeRentals,
      freeConsoles: invTotals.available,
      rentedConsoles: invTotals.rented,
      maintenanceConsoles: invTotals.maintenance,
    },
    finance: {
      today: revenueToday.total,
      week: revenueWeek.total,
      month: revenueMonth.total,
      total: revenueAll.total,
      promoDiscounts: promoDiscountAll,
      periodPromoDiscounts: periodPromoDiscount,
      delivery: {
        today: Number(deliveryToday._sum.deliveryFee ?? 0),
        week: Number(deliveryWeek._sum.deliveryFee ?? 0),
        month: Number(deliveryMonth._sum.deliveryFee ?? 0),
        total: Number(deliveryAll._sum.deliveryFee ?? 0),
      },
    },
    inventory,
    couriers: courierStats,
  };
}

function formatAnalyticsHtml(data) {
  const p = data.periodStats;
  const o = data.overview;
  const f = data.finance;
  const lines = [
    `📈 <b>Analytics</b> · ${escapeHtml(data.periodLabel)}`,
    `<i>${escapeHtml(formatDatetime(data.generatedAt))}</i>`,
    "",
    "📈 <b>Davr statistikasi</b>",
    `• Buyurtmalar: <b>${p.orders}</b>`,
    `• Faol ijaralar: <b>${p.active}</b>`,
    `• Tugallangan: <b>${p.completed}</b>`,
    `• Bekor qilingan: <b>${p.cancelled}</b>`,
    `• Rad etilgan: <b>${p.rejected}</b>`,
    `• Daromad: <b>${formatMoney(p.revenue)}</b>`,
    "",
    "━━━━━━━━━━━━━━",
    "",
    "📊 <b>Umumiy statistika</b>",
    `• Jami foydalanuvchilar: <b>${o.totalUsers}</b>`,
    `• Faol foydalanuvchilar (30 kun): <b>${o.activeUsers}</b>`,
    `• Yangi foydalanuvchilar (davr): <b>${o.newUsers}</b>`,
    `• Jami buyurtmalar: <b>${o.totalOrders}</b>`,
    `• Faol ijaralar: <b>${o.activeRentals}</b>`,
    `• Bo'sh konsollar: <b>${o.freeConsoles}</b>`,
    `• Band konsollar: <b>${o.rentedConsoles}</b>`,
    `• Ta'mirdagi konsollar: <b>${o.maintenanceConsoles}</b>`,
    "",
    "━━━━━━━━━━━━━━",
    "",
    "💰 <b>Moliyaviy hisobot</b>",
    `• Bugungi: <b>${formatMoney(f.today)}</b>`,
    `• Haftalik: <b>${formatMoney(f.week)}</b>`,
    `• Oylik: <b>${formatMoney(f.month)}</b>`,
    `• Umumiy: <b>${formatMoney(f.total)}</b>`,
    `• Promo chegirmalari: <b>${formatMoney(f.promoDiscounts)}</b>`,
    `• Yetkazib berish (jami): <b>${formatMoney(f.delivery.total)}</b>`,
    `  Bugun ${formatMoney(f.delivery.today)} · Hafta ${formatMoney(f.delivery.week)} · Oy ${formatMoney(f.delivery.month)}`,
    "",
    "━━━━━━━━━━━━━━",
    "",
    "🎮 <b>Inventar (Console)</b>",
  ];

  for (const type of ["PS3", "PS4", "PS5"]) {
    const row = data.inventory[type] || { total: 0, available: 0, rented: 0, maintenance: 0 };
    lines.push(
      `<b>${type}</b> — jami ${row.total} | bo'sh ${row.available} | band ${row.rented} | ta'mir ${row.maintenance}`
    );
  }

  lines.push("", "━━━━━━━━━━━━━━", "", "🚚 <b>Kuryerlar</b>");
  if (!data.couriers.length) {
    lines.push("Faol kuryer yo'q.");
  } else {
    for (const c of data.couriers) {
      lines.push(
        `• <b>${escapeHtml(c.name)}</b> — yetkazilgan ${c.delivered} | faol ${c.active} | bugun ${c.today}`
      );
    }
  }

  return lines.join("\n");
}

/** @deprecated alias — eski API */
async function getFullAnalytics() {
  return getAnalyticsDashboard(PERIODS.all);
}

async function getAnalyticsReport(period = PERIODS.today) {
  return getAnalyticsDashboard(period);
}

function formatAnalytics(data) {
  return formatAnalyticsHtml(data);
}

module.exports = {
  PERIODS,
  PERIOD_LABELS,
  getAnalyticsDashboard,
  getFullAnalytics,
  getAnalyticsReport,
  formatAnalytics,
  formatAnalyticsHtml,
};
