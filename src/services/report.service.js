const prisma = require("../config/prisma");

async function dailySummary(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lte: end } },
  });

  const completed = orders.filter((o) => o.status === "COMPLETED");
  const revenue = completed.reduce((sum, o) => sum + Number(o.totalPrice), 0);

  return {
    date: start,
    totalOrders: orders.length,
    completedOrders: completed.length,
    cancelledOrders: orders.filter((o) => o.status === "CANCELLED").length,
    revenue,
  };
}

async function generalStats() {
  const [totalUsers, totalCouriers, totalOrders, totalPlaystations] = await Promise.all([
    prisma.user.count(),
    prisma.courier.count(),
    prisma.order.count(),
    prisma.playstation.count(),
  ]);

  const paidPayments = await prisma.orderPayment.findMany({ where: { status: "PAID" } });
  const totalRevenue = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const byStatus = await prisma.order.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  return {
    totalUsers,
    totalCouriers,
    totalOrders,
    totalPlaystations,
    totalRevenue,
    ordersByStatus: byStatus.map((s) => ({ status: s.status, count: s._count.status })),
  };
}

async function topCouriers({ take = 5 } = {}) {
  const grouped = await prisma.order.groupBy({
    by: ["courierId"],
    where: { status: "COMPLETED", courierId: { not: null } },
    _count: { courierId: true },
    _sum: { totalPrice: true },
    orderBy: { _count: { courierId: "desc" } },
    take,
  });

  const results = [];
  for (const g of grouped) {
    const courier = await prisma.courier.findUnique({ where: { id: g.courierId } });
    results.push({
      courier,
      completedOrders: g._count.courierId,
      totalEarned: g._sum.totalPrice || 0,
    });
  }
  return results;
}

module.exports = { dailySummary, generalStats, topCouriers };
